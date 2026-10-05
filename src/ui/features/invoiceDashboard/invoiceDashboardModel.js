import { categoryLabelPtForTag } from "../../data/categoryLabels.js";
import {
  INVOICE_STATUS,
  buildInvoiceCards,
  historyStatus,
  invoiceKey,
} from "../cardHub/hubInvoices.js";
import { openInvoiceRef } from "./openInvoiceRef.js";

const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Fatura que ainda nem abriu: sem fatura real no servidor, só previsão. */
export function isForecastInvoice(card, year, month, now) {
  const open = openInvoiceRef(card, now);
  return invoiceKey(year, month) > invoiceKey(open.year, open.month);
}

/** Status final de uma fatura REAL (a que tem detalhe) frente à fatura aberta. */
export function resolveDetailStatus(rawStatus, year, month, openRef) {
  return historyStatus(rawStatus, invoiceKey(year, month), invoiceKey(openRef.year, openRef.month));
}

function detailEntry(detail, year, month, card, openRef) {
  return {
    key: invoiceKey(year, month),
    year,
    month,
    status: resolveDetailStatus(detail.status, year, month, openRef),
    total: num(detail.total_amount),
    itemsCount: num(detail.items_count),
    dueDate: detail.due_date || null,
    paidDate: detail.paid_date || null,
    limitUsagePercent: num(detail.limit_usage_percent),
    topCategory: topCategoryLabel(detail.category_breakdown),
    isEmpty: false,
    summaryKnown: true,
    cardId: card?.id ?? null,
  };
}

export function topCategoryLabel(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;
  const top = breakdown.reduce((best, row) => (Number(row.total) > Number(best.total) ? row : best), breakdown[0]);
  return top?.category_name ? categoryLabelPtForTag({ name: top.category_name }) : null;
}

/**
 * Faturas do seletor/carrossel: histórico + futuras (sem nenhuma chamada extra) e,
 * por cima, o que o detalhe da fatura selecionada já provou. As demais mostram só o
 * resumo que já veio de graça; uma fatura cujo resumo ninguém trouxe fica com total
 * `null` (desconhecido), nunca zero.
 */
export function buildDashboardInvoices({ card, history, future, selected, now }) {
  if (!card) return [];
  const openRef = openInvoiceRef(card, now);
  const openKey = invoiceKey(openRef.year, openRef.month);
  const list = buildInvoiceCards({ card, history, future, currentState: "unavailable", now, openRef })
    .map((entry) => ({ ...entry, summaryKnown: true }));
  const byKey = new Map(list.map((entry) => [entry.key, entry]));

  const ensure = (year, month, status) => {
    const key = invoiceKey(year, month);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key, year, month, status, total: null, itemsCount: null, dueDate: null, paidDate: null,
        limitUsagePercent: null, topCategory: null, isEmpty: false, summaryKnown: false,
        vsPercent: null, prevKey: null,
      });
    }
  };
  ensure(openRef.year, openRef.month, INVOICE_STATUS.OPEN);

  if (selected) {
    const { year, month, state, detail } = selected;
    const key = invoiceKey(year, month);
    if (state === "ok" && detail) {
      byKey.set(key, { ...(byKey.get(key) ?? {}), ...detailEntry(detail, year, month, card, openRef), vsPercent: null, prevKey: null });
    } else if (state === "empty") {
      byKey.set(key, {
        ...(byKey.get(key) ?? {}),
        key, year, month,
        status: key === openKey ? INVOICE_STATUS.OPEN : key > openKey ? INVOICE_STATUS.FORECAST : INVOICE_STATUS.CLOSED,
        total: null, itemsCount: 0, isEmpty: true, summaryKnown: true, vsPercent: null, prevKey: null,
      });
    } else if (state === "forecast") {
      ensure(year, month, INVOICE_STATUS.FORECAST);
    } else {
      ensure(year, month, key === openKey ? INVOICE_STATUS.OPEN : key > openKey ? INVOICE_STATUS.FORECAST : INVOICE_STATUS.CLOSED);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const FALLBACK_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED", "#DC2626", "#0891B2", "#DB2777", "#65A30D"];
const NO_CATEGORY_COLOR = "#6B7280";

/** Linhas do breakdown já com rótulo PT-BR, cor estável e fração para o donut. */
export function buildCategoryRows(breakdown) {
  if (!Array.isArray(breakdown)) return [];
  return breakdown.map((row, i) => {
    const total = num(row.total);
    return {
      key: row.category_id ?? `${row.category_name}-${i}`,
      name: row.category_name ? categoryLabelPtForTag({ name: row.category_name }) : "Sem categoria",
      color: row.category_color || (row.category_id == null ? NO_CATEGORY_COLOR : FALLBACK_COLORS[i % FALLBACK_COLORS.length]),
      total,
      percentage: num(row.percentage),
      count: num(row.transaction_count),
    };
  });
}

/** Top-N categorias + "Outras" agregando o resto (total só soma se todo o resto é conhecido). */
export function groupCategoryRows(rows, max = 5) {
  if (rows.length <= max + 1) return { visible: rows, rest: [] };
  const visible = rows.slice(0, max);
  const rest = rows.slice(max);
  const restTotals = rest.map((r) => r.total);
  const restPcts = rest.map((r) => r.percentage);
  const sum = (xs) => (xs.every((x) => x !== null) ? xs.reduce((a, b) => a + b, 0) : null);
  return {
    visible: [...visible, {
      key: "others", name: "Outras", color: "#9CA3AF", total: sum(restTotals), percentage: sum(restPcts),
      count: sum(rest.map((r) => r.count)), isOthers: true,
    }],
    rest,
  };
}

/** Arcos do donut: só fatias positivas e conhecidas entram (estorno não é fatia). */
export function buildDonutArcs(rows) {
  const positive = rows.filter((r) => r.total !== null && r.total > 0);
  const sum = positive.reduce((acc, r) => acc + r.total, 0);
  if (sum <= 0) return [];
  let offset = 0;
  return positive.map((r) => {
    const fraction = r.total / sum;
    const arc = { key: r.key, color: r.color, fraction, offset };
    offset += fraction;
    return arc;
  });
}

/** Posição de "hoje" entre o fechamento e o vencimento (0 a 100), ou `null` sem datas. */
export function timelineProgress({ closingDate, dueDate }, now) {
  const parse = (raw) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw ?? ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const closing = parse(closingDate);
  const due = parse(dueDate);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!closing) return { pct: null, beforeClosing: false, afterDue: today > due };
  if (today < closing) return { pct: 0, beforeClosing: true, afterDue: false };
  const span = due.getTime() - closing.getTime();
  const pct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((today.getTime() - closing.getTime()) / span) * 100));
  return { pct, beforeClosing: false, afterDue: today > due };
}
