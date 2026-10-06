import {
  closingDayForInvoiceAnchor,
  yearMonthOfOpenInvoiceByClosingDay,
} from "../../data/creditCardsAdapter.js";
import { categoryLabelPtForTag } from "../../data/categoryLabels.js";

/**
 * Normaliza as três fontes de faturas do cartão (histórico, fatura aberta e
 * compromissos futuros) num único formato de card, em ordem cronológica.
 * Resolvido só no frontend: nenhum endpoint novo.
 */

export const INVOICE_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
  PAID: "paid",
  FORECAST: "forecast",
};

export const INVOICE_STATUS_LABEL = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  forecast: "Prevista",
};

const pad2 = (n) => String(n).padStart(2, "0");
export const invoiceKey = (year, month) => `${year}-${pad2(month)}`;

export function parseInvoiceKey(raw) {
  const m = /^(\d{4})-(\d{2})/.exec(String(raw ?? ""));
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

function dueDateFor(year, month, dueDay) {
  const day = Number(dueDay);
  if (!Number.isFinite(day) || day < 1) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${invoiceKey(year, month)}-${pad2(Math.min(day, lastDay))}`;
}

function toFiniteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function topCategoryOf(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
  const top = breakdown.reduce((best, row) => (Number(row.total) > Number(best.total) ? row : best), breakdown[0]);
  return top?.category_name ? categoryLabelPtForTag({ name: top.category_name }) : null;
}

function historyStatus(raw, key, openKey) {
  if (raw === "paid") return INVOICE_STATUS.PAID;
  if (raw === "closed") return INVOICE_STATUS.CLOSED;
  // O histórico devolve "open" também para mês sem registro de fatura; só a fatura
  // aberta de verdade merece o rótulo: as anteriores já fecharam e as posteriores
  // ainda nem abriram (nunca duas "abertas").
  if (key < openKey) return INVOICE_STATUS.CLOSED;
  if (key > openKey) return INVOICE_STATUS.FORECAST;
  return INVOICE_STATUS.OPEN;
}

/**
 * @param {object} args
 * @param {object} args.card   cartão cru da API (`closing_day`, `due_day`)
 * @param {object|null} args.history   resposta de `/invoices/history`
 * @param {object|null} args.current   resposta de `/invoices/current`
 * @param {"ok"|"empty"|"unavailable"} args.currentState   `empty` = 404 (sem lançamentos)
 * @param {object|null} args.future   resposta de `/future-commitments`
 * @param {Date} [args.now]
 */
export function buildInvoiceCards({ card, history, current, currentState, future, now = new Date() }) {
  const currentRef = currentState === "ok" ? parseInvoiceKey(current?.month) : null;
  const openRef = currentRef
    ?? yearMonthOfOpenInvoiceByClosingDay(now, closingDayForInvoiceAnchor(card));
  const openKey = invoiceKey(openRef.year, openRef.month);
  const dueDay = card?.due_day;
  const byKey = new Map();

  (history?.monthly_data || []).forEach((row) => {
    const key = invoiceKey(row.year, row.month);
    byKey.set(key, {
      key,
      year: row.year,
      month: row.month,
      status: historyStatus(row.status, key, openKey),
      total: toFiniteOrNull(row.total_amount),
      itemsCount: toFiniteOrNull(row.items_count),
      dueDate: dueDateFor(row.year, row.month, dueDay),
      paidDate: null,
      limitUsagePercent: null,
      topCategory: row.top_category ? categoryLabelPtForTag({ name: row.top_category }) : null,
      isEmpty: false,
    });
  });

  if (currentState === "ok" && currentRef) {
    byKey.set(openKey, {
      key: openKey,
      year: currentRef.year,
      month: currentRef.month,
      status: ["open", "closed", "paid"].includes(current.status) ? current.status : INVOICE_STATUS.OPEN,
      total: toFiniteOrNull(current.total_amount),
      itemsCount: toFiniteOrNull(current.items_count),
      dueDate: current.due_date || dueDateFor(currentRef.year, currentRef.month, dueDay),
      paidDate: current.paid_date || null,
      limitUsagePercent: toFiniteOrNull(current.limit_usage_percent),
      apiVsPercent: toFiniteOrNull(current.month_over_month_change),
      topCategory: topCategoryOf(current.category_breakdown),
      isEmpty: false,
    });
  } else if (currentState === "empty") {
    const existing = byKey.get(openKey);
    if (!existing || existing.status === INVOICE_STATUS.OPEN) {
      byKey.set(openKey, {
        key: openKey,
        year: openRef.year,
        month: openRef.month,
        status: INVOICE_STATUS.OPEN,
        total: null,
        itemsCount: 0,
        dueDate: dueDateFor(openRef.year, openRef.month, dueDay),
        paidDate: null,
        limitUsagePercent: null,
        topCategory: null,
        isEmpty: true,
      });
    }
  }

  (future?.monthly_breakdown || []).forEach((row) => {
    const key = invoiceKey(row.year, row.month);
    if (byKey.has(key) || key <= openKey) return;
    byKey.set(key, {
      key,
      year: row.year,
      month: row.month,
      status: INVOICE_STATUS.FORECAST,
      total: toFiniteOrNull(row.total_amount),
      itemsCount: toFiniteOrNull(row.installments_count),
      dueDate: dueDateFor(row.year, row.month, dueDay),
      paidDate: null,
      limitUsagePercent: toFiniteOrNull(row.limit_usage_percent),
      topCategory: null,
      isEmpty: false,
    });
  });

  const cards = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return cards.map((entry, i) => {
    const prev = i > 0 ? cards[i - 1] : null;
    const adjacent = prev && prev.year * 12 + prev.month === entry.year * 12 + entry.month - 1;
    const vsPercent = adjacent && entry.total !== null && prev.total !== null && prev.total > 0
      ? Math.round(((entry.total - prev.total) / prev.total) * 100)
      : null;
    return { ...entry, vsPercent: entry.apiVsPercent ?? vsPercent, prevKey: adjacent ? prev.key : null };
  });
}

/** Fatura que abre selecionada: a aberta; sem ela, a última já emitida; sem nenhuma, a primeira. */
export function defaultInvoiceKey(cards) {
  const open = cards.find((c) => c.status === INVOICE_STATUS.OPEN);
  if (open) return open.key;
  const issued = cards.filter((c) => c.status !== INVOICE_STATUS.FORECAST);
  if (issued.length > 0) return issued[issued.length - 1].key;
  return cards[0]?.key ?? null;
}

/** "16 pagas · 1 aberta · 12 previstas" (só as categorias que existem). */
export function summarizeInvoiceCounts(cards) {
  const count = (status) => cards.filter((c) => c.status === status).length;
  const parts = [];
  const paid = count(INVOICE_STATUS.PAID);
  const closed = count(INVOICE_STATUS.CLOSED);
  const open = count(INVOICE_STATUS.OPEN);
  const forecast = count(INVOICE_STATUS.FORECAST);
  if (paid) parts.push(`${paid} ${paid === 1 ? "paga" : "pagas"}`);
  if (closed) parts.push(`${closed} ${closed === 1 ? "fechada" : "fechadas"}`);
  if (open) parts.push(`${open} ${open === 1 ? "aberta" : "abertas"}`);
  if (forecast) parts.push(`${forecast} ${forecast === 1 ? "prevista" : "previstas"}`);
  return parts.join(" · ");
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export const monthName = (month) => MONTH_NAMES[month - 1] ?? "";
export const monthShort = (month) => MONTH_SHORT[month - 1] ?? "";
export const monthNameLower = (month) => monthName(month).toLowerCase();

function formatDayMonth(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ""));
  return m ? `${m[3]}/${m[2]}` : null;
}

/** Texto do vencimento relativo a hoje: "vence em 15 dias (10/11)" etc. */
export function describeDue(dueDate, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dueDate ?? ""));
  if (!m) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const label = formatDayMonth(dueDate);
  if (days === 0) return `vence hoje (${label})`;
  if (days > 0) return `vence em ${days} ${days === 1 ? "dia" : "dias"} (${label})`;
  const ago = Math.abs(days);
  return `venceu há ${ago} ${ago === 1 ? "dia" : "dias"} (${label})`;
}

export function describePaidDate(paidDate) {
  const label = formatDayMonth(paidDate);
  return label ? `paga em ${label}` : null;
}
