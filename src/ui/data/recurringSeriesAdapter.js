import {
  listRecurringSeries,
  toggleRecurringSeries,
  createRecurringSeries,
  updateRecurringSeries,
  deleteRecurringSeries,
  changeRecurringSeriesValue,
} from "../../api/recurringSeries";
import { handleApiError } from "../../api/client";
import {
  categoryLabelPtForTag,
  resolveCategoryIconKey,
} from "./categoryLabels.js";
import { mapUiPaymentMethodToApi } from "./transactionsAdapter.js";
import { computeEndDateFromOccurrences } from "./recurrenceDateMath.js";

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

function formatFrequencyLabel(series) {
  const labels = {
    monthly: "Mensal",
    weekly: "Semanal",
    biweekly: "Quinzenal",
    yearly: "Anual",
  };
  if (series.frequency === "custom") {
    const n = Math.max(1, Number(series.interval) || 1);
    const unitMap = {
      day: n === 1 ? "dia" : "dias",
      week: n === 1 ? "semana" : "semanas",
      month: n === 1 ? "mês" : "meses",
    };
    const unit = unitMap[series.interval_unit] || "ocorrências";
    return `Personalizado · a cada ${n} ${unit}`;
  }
  const base = labels[series.frequency] || "Mensal";
  if (series.frequency === "monthly" && series.day_of_month) {
    return `${base} · dia ${series.day_of_month}`;
  }
  return base;
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
    monthly: "mensal",
    weekly: "semanal",
    biweekly: "quinzenal",
    yearly: "anual",
    custom: "personalizado",
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

function firstCategoryTag(tags) {
  if (!tags?.length) return null;
  const typeName = (t) => (t.tag_type?.name || "").toLowerCase();
  const cat = tags.find((t) => {
    const n = typeName(t);
    return n === "category" || n === "categoria";
  }) || tags[0];
  return cat || null;
}

function mergeSeriesTagIds(categoryTagId, detailTagIds) {
  const cat = categoryTagId != null ? String(categoryTagId) : "";
  const extras = Array.isArray(detailTagIds)
    ? detailTagIds.map((id) => String(id)).filter(Boolean)
    : [];
  const merged = cat ? [cat, ...extras.filter((id) => id !== cat)] : [...extras];
  return [...new Set(merged)];
}

function pickCategoryLabelPtSeries(series) {
  const tag = firstCategoryTag(series.tags);
  if (tag) return categoryLabelPtForTag(tag);
  if (series.category?.trim()) return series.category.trim();
  return series.type === "income" ? "Receita" : "Outros";
}

function pickCategoryIconKeySeries(series) {
  const tag = firstCategoryTag(series.tags);
  const labelPt = pickCategoryLabelPtSeries(series);
  return resolveCategoryIconKey(tag?.icon_key ?? null, labelPt);
}

/**
 * Mapeia `RecurringSeries` (API) → modelo da UI (Recorrências).
 * Mantém o nome `mapRecurringTransactionToUi` para compatibilidade com imports existentes.
 */
export function mapRecurringSeriesToUi(series) {
  const nextDate = series.next_occurrence?.slice(0, 10) || series.next_occurrence;
  const startDate = series.start_date?.slice(0, 10) || series.start_date;
  const endDate = series.end_date?.slice(0, 10) || series.end_date;

  return {
    id: series.id,
    logicalSeriesId: series.logical_series_id,
    desc: series.description,
    cat: pickCategoryLabelPtSeries(series),
    categoryIconKey: pickCategoryIconKeySeries(series),
    val: Number.parseFloat(series.value) || 0,
    dia: series.day_of_month ?? (nextDate ? Number.parseInt(nextDate.slice(8, 10), 10) || null : null),
    ativa: series.is_active,
    proximo: formatDate(nextDate),
    proximoFull: formatDate(nextDate),
    tipo: series.type === "income" ? "receita" : "despesa",
    metodo: formatPaymentMethod(series.payment_method),
    freq: formatFrequencyLabel(series),
    inicio: formatMonthYear(startDate),
    enc: endDate ? formatDate(endDate) : "Sem data fim",
    urgente: false,
    diasUrg: null,
    pago: false,
    valorTipo: series.value_kind === "approximate" ? "estimado" : "fixo",
    progPct: 0,
    status: series.is_active ? "ativa" : "pausada",
    nextOccurrenceIso: nextDate || null,
    startDateRaw: startDate || null,
    freqId: mapFrequencyId(series.frequency),
    methodId: mapMethodId(series.payment_method),
    encId: endDate ? "data" : "sem-fim",
    endDateRaw: endDate || null,
    creditCardId: series.credit_card_id ?? null,
    categoryTagId: firstCategoryTag(series.tags)?.id ?? null,
    dayOfMonth: series.day_of_month ?? null,
    dayOfWeek: series.day_of_week ?? null,
    interval: Number(series.interval) > 0 ? Number(series.interval) : 1,
    intervalUnit: series.interval_unit ?? null,
  };
}

/** @deprecated use mapRecurringSeriesToUi — alias histórico */
export const mapRecurringTransactionToUi = mapRecurringSeriesToUi;

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

/** `freqRec` do modal (apenas valores válidos pós-redesign): semanal|mensal|quinzenal|anual|personalizado. */
export function mapUiFreqRecToApi(freqRec) {
  const m = {
    semanal: "weekly",
    mensal: "monthly",
    quinzenal: "biweekly",
    anual: "yearly",
    personalizado: "custom",
  };
  return m[freqRec] || "monthly";
}

function derivedDayOfMonthFromYmd(ymd) {
  const n = Number.parseInt(String(ymd || "").slice(8, 10), 10);
  return Number.isFinite(n) ? n : null;
}

function derivedDayOfWeekFromYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

function applyFrequencyFields(payload, {
  frequency,
  startDateYmd,
  dayOfMonth,
  dayOfWeek,
  interval,
  intervalUnit,
}) {
  if (frequency === "monthly" || frequency === "yearly") {
    const dom = dayOfMonth ?? derivedDayOfMonthFromYmd(startDateYmd);
    if (Number.isFinite(Number(dom))) payload.day_of_month = Number(dom);
  }
  if (frequency === "weekly" || frequency === "biweekly") {
    const dow = dayOfWeek ?? derivedDayOfWeekFromYmd(startDateYmd);
    if (Number.isFinite(Number(dow))) payload.day_of_week = Number(dow);
  }
  if (frequency === "custom") {
    const n = Math.max(1, Number(interval) || 1);
    payload.interval = n;
    payload.interval_unit = intervalUnit || "month";
  }
}

function resolveEndDate({ frequency, encRec, endDateYmd, repetitions, startDateYmd, dayOfMonth, dayOfWeek, interval, intervalUnit }) {
  if (encRec === "data" && endDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(endDateYmd)) {
    return endDateYmd;
  }
  if (encRec === "repeticoes" && Number.isFinite(Number(repetitions)) && Number(repetitions) >= 1) {
    return computeEndDateFromOccurrences({
      startDateYmd,
      frequency,
      n: Number(repetitions),
      dayOfMonth: dayOfMonth ?? derivedDayOfMonthFromYmd(startDateYmd),
      dayOfWeek: dayOfWeek ?? derivedDayOfWeekFromYmd(startDateYmd),
      interval,
      intervalUnit,
    });
  }
  return null;
}

/**
 * Corpo para POST /recurring-series a partir do modal Nova transação / Nova recorrência.
 *
 * Campos novos (opcionais; preservam compat com chamadas antigas):
 *   dayOfWeek, dayOfMonth   — escolhidos no painel; default = derivado de startDateYmd
 *   interval, intervalUnit  — usados quando freqRec="personalizado"
 *   repetitions             — N quando encRec="repeticoes" (UI converte em end_date)
 */
export function buildCreateRecurringSeriesPayload({
  tipo,
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  startDateYmd,
  freqRec,
  encRec,
  endDateYmd,
  valorTipoRec,
  categoryLabel,
  cardId = null,
  dayOfWeek = null,
  dayOfMonth = null,
  interval = 1,
  intervalUnit = null,
  repetitions = null,
}) {
  const frequency = mapUiFreqRecToApi(freqRec);
  const payload = {
    type: tipo === "receita" ? "income" : "expense",
    description: String(description || "").trim() || "—",
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    frequency,
    start_date: startDateYmd,
    tag_ids: categoryTagId
      ? mergeSeriesTagIds(categoryTagId, detailTagIds)
      : undefined,
    value_kind: valorTipoRec === "estimado" ? "approximate" : "exact",
  };
  applyFrequencyFields(payload, { frequency, startDateYmd, dayOfMonth, dayOfWeek, interval, intervalUnit });
  const endDate = resolveEndDate({
    frequency, encRec, endDateYmd, repetitions, startDateYmd,
    dayOfMonth, dayOfWeek, interval, intervalUnit,
  });
  if (endDate) payload.end_date = endDate;
  if (categoryLabel?.trim()) payload.category = categoryLabel.trim();
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.credit_card_id = Number(cardId);
  }
  return payload;
}

/**
 * Corpo para PATCH /recurring-series/:id (edição pelo modal).
 */
export function buildUpdateRecurringSeriesPayload({
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  startDateYmd,
  freqRec,
  encRec,
  endDateYmd,
  valorTipoRec,
  categoryLabel,
  cardId = null,
  dayOfWeek = null,
  dayOfMonth = null,
  interval = 1,
  intervalUnit = null,
  repetitions = null,
}) {
  const frequency = mapUiFreqRecToApi(freqRec);
  const payload = {
    description: String(description || "").trim() || undefined,
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    frequency,
    value_kind: valorTipoRec === "estimado" ? "approximate" : "exact",
    tag_ids: categoryTagId
      ? mergeSeriesTagIds(categoryTagId, detailTagIds)
      : undefined,
  };
  applyFrequencyFields(payload, { frequency, startDateYmd, dayOfMonth, dayOfWeek, interval, intervalUnit });
  const endDate = resolveEndDate({
    frequency, encRec, endDateYmd, repetitions, startDateYmd,
    dayOfMonth, dayOfWeek, interval, intervalUnit,
  });
  if (endDate) {
    payload.end_date = endDate;
  } else if (encRec === "sem-fim") {
    payload.end_date = null;
  }
  if (categoryLabel?.trim()) payload.category = categoryLabel.trim();
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.credit_card_id = Number(cardId);
  }
  return payload;
}

export async function listRecurringSeriesForUi(organizationId, isActive, period) {
  const params = {};
  if (isActive !== undefined) params.isActive = isActive;
  if (period?.dateStart && period?.dateEnd) {
    params.dateStart = period.dateStart;
    params.dateEnd = period.dateEnd;
  }
  return listRecurringSeries(organizationId, Object.keys(params).length ? params : undefined);
}

export async function toggleRecurringSeriesForUi(seriesId, organizationId, isActive) {
  return toggleRecurringSeries(seriesId, organizationId, { is_active: isActive });
}

export async function createRecurringSeriesForUi(organizationId, payload) {
  return createRecurringSeries(organizationId, payload);
}

export async function updateRecurringSeriesForUi(seriesId, organizationId, payload) {
  return updateRecurringSeries(seriesId, organizationId, payload);
}

export async function deleteRecurringSeriesForUi(seriesId, organizationId) {
  return deleteRecurringSeries(seriesId, organizationId);
}

/** Troca de valor com versionamento (fecha série atual + cria nova). */
export async function changeRecurringSeriesValueForUi(seriesId, organizationId, body) {
  return changeRecurringSeriesValue(seriesId, organizationId, body);
}

export function formatRecurringApiError(error) {
  return handleApiError(error);
}

/** @deprecated */
export const formatRecurringTransactionsApiError = formatRecurringApiError;
