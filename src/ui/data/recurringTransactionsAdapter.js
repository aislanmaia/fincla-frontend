import {
  listRecurringTransactions,
  toggleRecurringTransaction,
} from "../../api/recurringTransactions";
import { handleApiError } from "../../api/client";
import {
  categoryLabelPtForTag,
  resolveCategoryIconKey,
} from "./categoryLabels.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function formatMonthYear(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const month = date.toLocaleDateString("pt-BR", { month: "short" });
  return `${month.charAt(0).toUpperCase()}${month.slice(1, 3)} ${date.getFullYear()}`;
}

function formatFrequencyLabel(transaction) {
  const labels = {
    daily: "Diária",
    weekly: "Semanal",
    monthly: "Mensal",
    yearly: "Anual",
  };
  if (transaction.frequency === "monthly" && transaction.day_of_month) {
    return `${labels[transaction.frequency]} · dia ${transaction.day_of_month}`;
  }
  return labels[transaction.frequency] || "Mensal";
}

function formatPaymentMethod(method) {
  const labels = {
    pix: "Pix",
    boleto: "Boleto",
    debit: "Débito",
    credit: "Cartão crédito",
    bank_transfer: "Transferência",
    transfer: "Transferência",
  };
  return labels[method] || method?.replace(/_/g, " ") || "Pix";
}

function mapFrequencyId(frequency) {
  const ids = {
    daily: "diario",
    weekly: "semanal",
    monthly: "mensal",
    yearly: "anual",
  };
  return ids[frequency] || "mensal";
}

function mapMethodId(method) {
  const ids = {
    pix: "pix",
    boleto: "boleto",
    debit: "debito",
    credit: "credito",
    bank_transfer: "transferencia",
    transfer: "transferencia",
  };
  return ids[method] || "pix";
}

function firstCategoryTag(transaction) {
  const tags = transaction.tags;
  if (!tags?.length) return null;
  const typeName = (t) => (t.tag_type?.name || "").toLowerCase();
  const cat = tags.find((t) => {
    const n = typeName(t);
    return n === "category" || n === "categoria";
  }) || tags[0];
  return cat || null;
}

function pickCategoryLabelPt(transaction) {
  const tag = firstCategoryTag(transaction);
  if (tag) return categoryLabelPtForTag(tag);
  return transaction.type === "income" ? "Receita" : "Outros";
}

function pickCategoryIconKey(transaction) {
  const tag = firstCategoryTag(transaction);
  const labelPt = pickCategoryLabelPt(transaction);
  return resolveCategoryIconKey(tag?.icon_key ?? null, labelPt);
}

export function mapRecurringTransactionToUi(transaction) {
  const nextDate = transaction.next_occurrence?.slice(0, 10) || transaction.next_occurrence;
  const startDate = transaction.start_date?.slice(0, 10) || transaction.start_date;
  const endDate = transaction.end_date?.slice(0, 10) || transaction.end_date;

  return {
    id: transaction.id,
    desc: transaction.description,
    cat: pickCategoryLabelPt(transaction),
    categoryIconKey: pickCategoryIconKey(transaction),
    val: transaction.value,
    dia: transaction.day_of_month,
    ativa: transaction.is_active,
    proximo: formatDate(nextDate),
    proximoFull: formatDate(nextDate),
    tipo: transaction.type === "income" ? "receita" : "despesa",
    metodo: formatPaymentMethod(transaction.payment_method),
    freq: formatFrequencyLabel(transaction),
    inicio: formatMonthYear(startDate),
    enc: endDate ? formatDate(endDate) : "Sem data fim",
    urgente: false,
    diasUrg: null,
    pago: false,
    valorTipo: "fixo",
    progPct: 0,
    status: transaction.is_active ? "ativa" : "pausada",
    nextOccurrenceIso: nextDate || null,
    freqId: mapFrequencyId(transaction.frequency),
    methodId: mapMethodId(transaction.payment_method),
    encId: endDate ? "data" : "sem-fim",
    endDateRaw: endDate || null,
  };
}

export function mapRecurringSummaryToUi(summary) {
  return {
    totalRec: summary?.total_monthly_income || 0,
    totalDesp: summary?.total_monthly_expense || 0,
    saldoFixo: (summary?.total_monthly_income || 0) - (summary?.total_monthly_expense || 0),
    activeCount: summary?.active_count || 0,
    pausedCount: summary?.paused_count || 0,
  };
}

export function buildUpcomingRecurringSummary(list, todayIso = null) {
  const base = todayIso ? new Date(`${todayIso}T00:00:00`) : new Date();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const items = list.filter((item) => {
    if (!item.ativa || item.tipo !== "despesa" || !item.nextOccurrenceIso) return false;
    const target = new Date(`${item.nextOccurrenceIso}T00:00:00`);
    if (Number.isNaN(target.getTime())) return false;
    const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  return {
    items,
    total: items.reduce((sum, item) => sum + item.val, 0),
  };
}

export async function listRecurringTransactionsForUi(organizationId) {
  return listRecurringTransactions(organizationId);
}

export async function toggleRecurringTransactionForUi(transactionId, organizationId) {
  return toggleRecurringTransaction(transactionId, organizationId);
}

export function formatRecurringTransactionsApiError(error) {
  return handleApiError(error);
}
