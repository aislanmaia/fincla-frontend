import {
  createCreditCard,
  getConsolidatedCommitments,
  getCreditCardInvoice,
  getFutureCommitments,
  getInvoiceHistory,
  listCreditCards,
  markInvoicePaid,
  moveInstallmentToInvoice,
  updateCreditCard,
} from "../../api/creditCards";
import { handleApiError } from "../../api/client";
import { categoryLabelPtForTag } from "./categoryLabels.js";

function parseMoneyInput(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatLongDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function formatInvoiceLabel(year, month) {
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1, 3)}'${String(year).slice(-2)}`;
}

function monthFromApiString(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function shiftYearMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function startOfLocalDay(ref) {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

function closingDayForInvoiceAnchor(card) {
  const c = card?.closing_day;
  if (c != null && Number.isFinite(Number(c))) return Number(c);
  const d = card?.due_day;
  if (d != null && Number.isFinite(Number(d))) return Number(d);
  return 1;
}

function daysInCalendarMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Ano/mês da fatura aberta pelo calendário de fechamento (dia no `closingDayRaw`). */
function yearMonthOfOpenInvoiceByClosingDay(refDate, closingDayRaw) {
  const closingDay = Math.min(Math.max(1, Number(closingDayRaw) || 1), 31);
  const ty = refDate.getFullYear();
  const tm0 = refDate.getMonth();
  const dim = daysInCalendarMonth(ty, tm0 + 1);
  const closeThis = new Date(ty, tm0, Math.min(closingDay, dim));
  const today0 = startOfLocalDay(refDate);

  let result;
  if (today0 > startOfLocalDay(closeThis)) {
    let ny = ty;
    let nm0 = tm0 + 1;
    if (nm0 > 11) {
      nm0 = 0;
      ny += 1;
    }
    const dimNext = daysInCalendarMonth(ny, nm0 + 1);
    const closeNext = new Date(ny, nm0, Math.min(closingDay, dimNext));
    result = { year: closeNext.getFullYear(), month: closeNext.getMonth() + 1 };
  } else {
    result = { year: closeThis.getFullYear(), month: closeThis.getMonth() + 1 };
  }
  return result;
}

function isInvoiceClosingBeforeToday(invoice, today = new Date()) {
  if (!invoice?.closing_date) return false;
  const close = startOfLocalDay(new Date(`${invoice.closing_date}T12:00:00`));
  return close < startOfLocalDay(today);
}

/**
 * Busca a fatura corrente: inicia no mês de fechamento esperado; avança só com
 * `paid` ou `open` com fechamento já passado. `closed` não avança (fatura em aberto para pagamento).
 */
async function fetchOpenCreditCardInvoiceForList(cardId, organizationId, card) {
  const now = new Date();
  const start = yearMonthOfOpenInvoiceByClosingDay(now, closingDayForInvoiceAnchor(card));
  let y = start.year;
  let m = start.month;
  let lastOk = null;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    try {
      const inv = await getCreditCardInvoice(cardId, y, m, organizationId);
      lastOk = inv;

      if (inv.status === "paid") {
        const n = shiftYearMonth(y, m, 1);
        y = n.year;
        m = n.month;
        continue;
      }

      if (inv.status === "open" && isInvoiceClosingBeforeToday(inv, now)) {
        const n = shiftYearMonth(y, m, 1);
        y = n.year;
        m = n.month;
        continue;
      }

      return inv;
    } catch {
      if (lastOk && lastOk.status === "open" && isInvoiceClosingBeforeToday(lastOk, now)) {
        return lastOk;
      }
      const n = shiftYearMonth(y, m, 1);
      y = n.year;
      m = n.month;
    }
  }

  return lastOk;
}

function syntheticInvoiceFromBreakdownRow(row) {
  return {
    month: `${row.year}-${String(row.month).padStart(2, "0")}`,
    due_date: "",
    total_amount: row.total_amount,
    status: "open",
    items: [],
    closing_date: null,
    days_until_due: 0,
    is_overdue: false,
    paid_date: null,
    previous_month_total: null,
    month_over_month_change: null,
    limit_usage_percent: row.limit_usage_percent ?? null,
    items_count: 0,
    category_breakdown: [],
  };
}

/** Ciclo `open` com fechamento passado: tenta o mês seguinte sequencial (não o 1º mês do breakdown). */
async function resolveStaleOpenInvoiceWithPlanning(
  cardId,
  organizationId,
  invoice,
  futureCommitments,
) {
  if (
    !invoice ||
    invoice.status !== "open" ||
    !isInvoiceClosingBeforeToday(invoice)
  ) {
    return invoice;
  }
  const ref = monthFromApiString(invoice?.month);
  if (!ref) return invoice;
  const nextYm = shiftYearMonth(ref.year, ref.month, 1);
  try {
    const nextInv = await getCreditCardInvoice(
      cardId,
      nextYm.year,
      nextYm.month,
      organizationId,
    );
    return nextInv;
  } catch {
    const breakdown = futureCommitments?.monthly_breakdown || [];
    const row = breakdown.find(
      (r) => r.year === nextYm.year && r.month === nextYm.month,
    );
    return syntheticInvoiceFromBreakdownRow({
      year: nextYm.year,
      month: nextYm.month,
      total_amount: row?.total_amount ?? 0,
      limit_usage_percent: row?.limit_usage_percent ?? null,
    });
  }
}

function appendFutureCommitmentMonthsToFaturas(faturas, futureCommitments, dueDay) {
  const byId = new Set((faturas || []).map((f) => f.id));
  const dueLabel = Number.isFinite(Number(dueDay)) ? `dia ${dueDay}` : "—";
  const extra = (futureCommitments?.monthly_breakdown || [])
    .filter((item) => !byId.has(`${item.year}-${item.month}`))
    .map((item) => ({
      id: `${item.year}-${item.month}`,
      mes: formatInvoiceLabel(item.year, item.month),
      val: item.total_amount,
      pago: false,
      venc: dueLabel,
      atual: false,
      year: item.year,
      month: item.month,
    }));
  return [...(faturas || []), ...extra].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );
}

/** Índice inicial do seletor de faturas na linha marcada `atual`. */
export function defaultFaturaIndexForCard(faturas) {
  if (!faturas?.length) return 0;
  const atualIdx = faturas.findIndex((f) => f.atual);
  return atualIdx >= 0 ? atualIdx : faturas.length - 1;
}

export function faturaIdxMatchingInvoiceRef(faturasList, invoiceRef) {
  const list = Array.isArray(faturasList) ? faturasList : [];
  const fallback = defaultFaturaIndexForCard(list);
  if (!invoiceRef || list.length === 0) return fallback;
  if (invoiceRef.year != null && invoiceRef.month != null) {
    const i = list.findIndex(
      (f) =>
        Number(f.year) === Number(invoiceRef.year) &&
        Number(f.month) === Number(invoiceRef.month),
    );
    if (i >= 0) return i;
  }
  if (invoiceRef.id != null && invoiceRef.id !== "") {
    const i = list.findIndex((f) => f.id === invoiceRef.id);
    if (i >= 0) return i;
  }
  return fallback;
}

export function faturaIdxAfterCardsRefresh(nextCard, prevCards, prevFaturaIdx) {
  const faturasList = nextCard?.faturas || [];
  const prevCard = prevCards?.find((c) => c.id === nextCard?.id);
  const prevInvoice = prevCard?.faturas?.[prevFaturaIdx];
  return prevInvoice
    ? faturaIdxMatchingInvoiceRef(faturasList, prevInvoice)
    : defaultFaturaIndexForCard(faturasList);
}

/** Gradientes de referência (alinhados ao mock CARTOES_DATA na UI) */
const CARD_GRADIENT_PRESETS = [
  { cor1: "#6016A8", cor2: "#8B11D4", corChip: "#A855F7" },
  { cor1: "#003087", cor2: "#0050C8", corChip: "#60A5FA" },
  { cor1: "#1C1C1E", cor2: "#3A3A3C", corChip: "#D4AF37" },
  { cor1: "#0F766E", cor2: "#14B8A6", corChip: "#5EEAD4" },
  { cor1: "#B45309", cor2: "#D97706", corChip: "#FBBF24" },
  { cor1: "#BE123C", cor2: "#E11D48", corChip: "#FDA4AF" },
  { cor1: "#1D4ED8", cor2: "#3B82F6", corChip: "#93C5FD" },
  { cor1: "#4338CA", cor2: "#6366F1", corChip: "#A5B4FC" },
];

/** Cor única “genérica” da API → tratar como ausência e variar por cartão */
const GENERIC_API_HEX = /^#?(334155|64748b|94a3b8)$/i;

function parseHex6(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[c(r), c(g), c(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** A partir de uma cor da API, monta gradiente + accent (evita cartão “chapado”) */
function expandHexToGradient(normalizedHex) {
  const rgb = parseHex6(normalizedHex);
  if (!rgb) return null;
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const dark = mixRgb(rgb, black, 0.22);
  const light = mixRgb(rgb, white, 0.2);
  const chip = mixRgb(rgb, white, 0.48);
  return {
    cor1: rgbToHex(dark.r, dark.g, dark.b),
    cor2: rgbToHex(light.r, light.g, light.b),
    corChip: rgbToHex(chip.r, chip.g, chip.b),
    corText: "#fff",
  };
}

function stablePaletteIndex(card) {
  const key = `${card.id ?? ""}:${card.last4 ?? ""}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % CARD_GRADIENT_PRESETS.length;
}

function resolveCardColors(card) {
  const raw = card.color != null ? String(card.color).trim() : "";
  const withHash = raw ? (raw.startsWith("#") ? raw : `#${raw}`) : "";
  const isGenericOrEmpty =
    !withHash || GENERIC_API_HEX.test(withHash.replace(/^#/, ""));

  if (withHash && !isGenericOrEmpty && parseHex6(withHash)) {
    const expanded = expandHexToGradient(withHash);
    if (expanded) return expanded;
  }

  const preset = CARD_GRADIENT_PRESETS[stablePaletteIndex(card)];
  return { ...preset, corText: "#fff" };
}

function pickFirstTag(item) {
  const groups = Object.values(item.tags || {});
  return groups.flat()?.[0] || null;
}

function pickCategory(item) {
  const tag = pickFirstTag(item);
  if (!tag) return "Outros";
  return categoryLabelPtForTag(tag);
}

function pickCategoryColor(item) {
  const tag = pickFirstTag(item);
  return tag?.color || null;
}

function pickIcon(labelPt) {
  const n = String(labelPt || "").toLowerCase();
  if (n.includes("alimenta") || n.includes("food")) return "🛒";
  if (n.includes("transport")) return "🚗";
  if (n.includes("saúd") || n.includes("health")) return "💪";
  if (n.includes("educa")) return "📚";
  if (n.includes("lazer") || n.includes("entret") || n.includes("leisure")) return "🎉";
  if (n.includes("compras") || n.includes("shopping")) return "🛍️";
  if (n.includes("serviço") || n.includes("servic")) return "🔧";
  if (n.includes("assinatura") || n.includes("software") || n.includes("subscri")) return "📺";
  if (n.includes("imposto") || n.includes("taxa") || n.includes("tax")) return "🧾";
  if (n.includes("morad") || n.includes("hous")) return "🏠";
  if (n.includes("receita") || n.includes("income") || n.includes("renda")) return "💰";
  return "💳";
}

function isRecurringItem(item) {
  if (item.is_recurring) return true;
  const category = pickCategory(item).toLowerCase();
  const description = String(item.description || "").toLowerCase();
  const recurringCats = ["assin", "subscription", "software", "streaming"];
  const recurringDescs = ["netflix", "spotify", "prime", "disney", "hbo", "youtube", "apple",
    "google", "adobe", "notion", "figma", "canva", "chatgpt", "openai", "icloud",
    "dropbox", "github", "slack", "zoom", "microsoft", "office", "ifood"];
  return item.total_installments === 1 && (
    recurringCats.some(k => category.includes(k)) ||
    recurringDescs.some(k => description.includes(k))
  );
}

function invoiceDateKey(raw) {
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw));
  return m ? m[1] : null;
}

function mapInvoiceItemToUi(item) {
  const category = pickCategory(item);
  const dk = invoiceDateKey(item.transaction_date);
  const isRefund = item.modality === "refund";
  // Estorno: avatar/icone ↺ e descrição com prefixo limpo. O valor em si segue item.amount;
  // a soma da fatura no backend considera modality='refund' como negativo.
  const cleanDesc = isRefund
    ? (item.description.toLowerCase().startsWith("estorno")
        ? item.description
        : `Estorno: ${item.description}`)
    : item.description;
  return {
    id: item.id,
    chargeId: item.charge_id,
    installmentId: item.id,
    transactionId: item.transaction_id ?? null,
    desc: cleanDesc,
    cat: category,
    catColor: pickCategoryColor(item),
    val: item.amount,
    data: formatShortDate(item.transaction_date),
    dataKey: dk || undefined,
    icon: isRefund ? "↺" : pickIcon(category),
    rec: !isRefund && isRecurringItem(item),
    modality: item.modality || "installment",
    isRefund,
    parcela: !isRefund && item.total_installments > 1 ? {
      n: item.installment_number,
      t: item.total_installments,
      val: item.amount,
      total: item.purchase_info?.total_value ?? item.amount * item.total_installments,
    } : null,
    purchaseInfo: item.purchase_info || null,
    // refunds_summary da transação pai — populado pelo backend quando a compra tem estornos linkados.
    // Usado pra exibir badge/seção "↺ Esta compra tem estorno relacionado" nas parcelas futuras.
    refundsSummary: item.refunds_summary
      ? {
          count: Number(item.refunds_summary.count) || 0,
          totalValue: Number(item.refunds_summary.total_value) || 0,
        }
      : null,
  };
}

function mapInvoiceHistoryToUi(card, history, currentInvoice) {
  const mapped = (history?.monthly_data || []).map((item) => ({
    id: `${item.year}-${item.month}`,
    mes: formatInvoiceLabel(item.year, item.month),
    val: item.total_amount,
    pago: item.status === "paid",
    venc: `dia ${card.due_day}`,
    atual: false,
    year: item.year,
    month: item.month,
  }));

  const currentMonth = monthFromApiString(currentInvoice?.month);
  if (!currentMonth || !currentInvoice) {
    return mapped.sort((a, b) => (a.year - b.year) || (a.month - b.month));
  }

  const currentMapped = {
    id: `${currentMonth.year}-${currentMonth.month}`,
    mes: formatInvoiceLabel(currentMonth.year, currentMonth.month),
    val: currentInvoice.total_amount,
    pago: currentInvoice.status === "paid",
    venc: currentInvoice.due_date
      ? formatLongDate(currentInvoice.due_date)
      : `dia ${card.due_day}`,
    atual: true,
    year: currentMonth.year,
    month: currentMonth.month,
  };

  const filtered = mapped.filter((item) => item.id !== currentMapped.id);
  return [...filtered, currentMapped].sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

function aggregateInstallments(currentInvoice) {
  const map = new Map();
  const isPaidInvoice = currentInvoice?.status === "paid";

  (currentInvoice?.items || []).forEach((item) => {
    if (item.modality === "refund") return;
    if (item.total_installments <= 1) return;
    const key = `${item.charge_id}-${item.description}`;
    map.set(key, {
      id: key,
      desc: item.description,
      cat: pickCategory(item),
      vParcela: item.amount,
      pago: Math.max(0, item.installment_number - (isPaidInvoice ? 0 : 1)),
      total: item.total_installments,
      vTotal: item.purchase_info?.total_value || item.amount * item.total_installments,
      // Propaga refunds_summary da transação pai pra UI renderizar badge "↺ Tem estorno".
      refundsSummary: item.refunds_summary
        ? {
            count: Number(item.refunds_summary.count) || 0,
            totalValue: Number(item.refunds_summary.total_value) || 0,
          }
        : null,
      icon: pickIcon(pickCategory(item)),
      chargeId: item.charge_id,
      installmentId: item.id,
    });
  });

  return Array.from(map.values());
}

function translateCategoryName(name) {
  return categoryLabelPtForTag({ name }) || name;
}

function buildTrendFromCurrentInvoice(currentInvoice) {
  if (!currentInvoice?.category_breakdown?.length) return [];
  const month = monthFromApiString(currentInvoice.month);
  if (!month) return [];
  return [{
    mes: formatInvoiceLabel(month.year, month.month),
    ...Object.fromEntries(currentInvoice.category_breakdown.map((item) => [
      translateCategoryName(item.category_name), item.total,
    ])),
  }];
}

function buildPlanningMonths(futureCommitments) {
  return (futureCommitments?.monthly_breakdown || []).map((item) => ({
    mes: formatInvoiceLabel(item.year, item.month),
    total: item.total_amount,
    count: item.installments_count,
    itens: item.top_installments.map((installment, index) => ({
      id: `${item.year}-${item.month}-${index}-${installment.description}`,
      desc: installment.description,
      val: installment.amount,
      hasRefundsLinked: Boolean(installment.has_refunds_linked),
      refundsCount: Number(installment.refunds_count) || 0,
      refundsTotalValue: Number(installment.refunds_total_value) || 0,
    })),
  }));
}

export function mapCreditCardToUi({ card, currentInvoice, history, futureCommitments, consolidatedCommitments = null }) {
  const colors = resolveCardColors(card);
  const itens = (currentInvoice?.items || []).map(mapInvoiceItemToUi);
  const faturas = appendFutureCommitmentMonthsToFaturas(
    mapInvoiceHistoryToUi(card, history, currentInvoice),
    futureCommitments,
    card.due_day,
  );
  const parcelasAtivas = aggregateInstallments(currentInvoice);

  return {
    id: String(card.id),
    cardId: card.id,
    banco: card.brand,
    apiColor: card.color ?? null,
    nome: card.description || `${card.brand} •• ${card.last4}`,
    dig: card.last4,
    bandeira: card.brand,
    vencimento: card.due_day,
    fechamento: card.closing_day || 1,
    limite: card.credit_limit || 0,
    disponivel: card.available_limit ?? Math.max(0, (card.credit_limit || 0) - (card.used_limit || 0)),
    faturas,
    tendencia: buildTrendFromCurrentInvoice(currentInvoice),
    itens,
    parcelas_ativas: parcelasAtivas,
    planejamento: buildPlanningMonths(futureCommitments),
    analytics: {
      historySummary: history?.summary || null,
      commitmentsSummary: futureCommitments?.summary || null,
      consolidatedCommitments,
      categoryBreakdown: (currentInvoice?.category_breakdown || []).map((cb) => ({
        ...cb,
        category_name: translateCategoryName(cb.category_name),
      })),
      currentInvoice: currentInvoice || null,
    },
    ...colors,
  };
}

export function buildCreateCreditCardPayload({
  organizationId,
  brand,
  displayName,
  last4Digits,
  limitInput,
  dueDay,
  closingDay,
  color = null,
}) {
  return {
    organization_id: organizationId,
    last4: String(last4Digits || "").replace(/\D/g, "").slice(-4),
    brand: brand || "Visa",
    due_day: Number(dueDay) || 1,
    description: displayName || null,
    credit_limit: parseMoneyInput(limitInput),
    closing_day: closingDay ? Number(closingDay) : undefined,
    color: color || undefined,
  };
}

export function buildUpdateCreditCardPayload({
  organizationId,
  brand,
  displayName,
  last4Digits,
  limitInput,
  dueDay,
  closingDay,
  color = undefined,
}) {
  const payload = {
    organization_id: organizationId,
  };
  if (brand !== undefined) payload.brand = brand || "Visa";
  if (displayName !== undefined) payload.description = displayName || null;
  if (last4Digits !== undefined) {
    payload.last4 = String(last4Digits || "").replace(/\D/g, "").slice(-4);
  }
  if (limitInput !== undefined && limitInput !== "") {
    payload.credit_limit = parseMoneyInput(limitInput);
  }
  if (dueDay !== undefined && dueDay !== "") {
    payload.due_day = Number(dueDay) || 1;
  }
  if (closingDay !== undefined && closingDay !== "") {
    payload.closing_day = Number(closingDay);
  }
  if (color !== undefined) payload.color = color || undefined;

  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
}

/** Linha do picker de cartão no modal Nova transação (UI legada). */
export function mapCreditCardToModalPickerRow(card) {
  const limit = card.credit_limit != null ? Number(card.credit_limit) : 0;
  const used = Number(card.used_limit) || 0;
  const availRaw = card.available_limit;
  const disp = Number(availRaw != null ? availRaw : Math.max(0, limit - used)) || 0;
  const brand = String(card.brand || "Cartão").trim();
  const last4 = String(card.last4 || "").replace(/\D/g, "").slice(-4);
  const desc = card.description?.trim();
  return {
    id: String(card.id),
    banco: brand.toUpperCase(),
    nome: desc || (last4 ? `${brand || "Cartão"} •• ${last4}` : brand || "Cartão"),
    dig: last4,
    disp,
    novo: false,
  };
}

export async function listCreditCardsForUi(organizationId) {
  const cards = await listCreditCards(organizationId);
  let consolidatedCommitments = null;
  try {
    consolidatedCommitments = await getConsolidatedCommitments(organizationId);
  } catch {
    consolidatedCommitments = null;
  }

  const detailed = await Promise.all(cards.map(async (card) => {
    let history = {
      card_id: card.id,
      card_name: card.description || `${card.brand} •• ${card.last4}`,
      period_start: "",
      period_end: "",
      summary: {
        total_spent: 0,
        average_monthly: 0,
        highest_month: null,
        lowest_month: null,
      },
      monthly_data: [],
    };
    let futureCommitments = {
      card_id: card.id,
      card_name: card.description || `${card.brand} •• ${card.last4}`,
      card_last4: card.last4,
      credit_limit: card.credit_limit,
      current_available_limit: card.available_limit,
      summary: {
        total_committed: 0,
        average_monthly: 0,
        lowest_month: null,
        highest_month: null,
      },
      monthly_breakdown: [],
      ending_soon: [],
      insights: [],
    };

    try {
      history = await getInvoiceHistory(card.id, organizationId);
    } catch {}

    try {
      futureCommitments = await getFutureCommitments(card.id, organizationId);
    } catch {}

    let currentInvoice = null;
    try {
      currentInvoice = await fetchOpenCreditCardInvoiceForList(
        card.id,
        organizationId,
        card,
      );
    } catch {
      currentInvoice = null;
    }

    if (currentInvoice) {
      currentInvoice = await resolveStaleOpenInvoiceWithPlanning(
        card.id,
        organizationId,
        currentInvoice,
        futureCommitments,
      );
    }

    if (!currentInvoice) {
      const anchor = yearMonthOfOpenInvoiceByClosingDay(
        new Date(),
        closingDayForInvoiceAnchor(card),
      );
      const breakdown = futureCommitments?.monthly_breakdown || [];
      const row = breakdown.find(
        (r) => r.year === anchor.year && r.month === anchor.month,
      );
      currentInvoice = syntheticInvoiceFromBreakdownRow({
        year: anchor.year,
        month: anchor.month,
        total_amount: row?.total_amount ?? 0,
        limit_usage_percent: row?.limit_usage_percent ?? null,
      });
    }

    return mapCreditCardToUi({
      card,
      currentInvoice,
      history,
      futureCommitments,
      consolidatedCommitments,
    });
  }));

  return {
    cards: detailed,
    consolidatedCommitments,
  };
}

export async function createCreditCardForUi(payload) {
  return createCreditCard(payload);
}

export async function updateCreditCardForUi(cardId, payload) {
  return updateCreditCard(cardId, payload);
}

export async function markInvoicePaidForUi({ cardId, year, month, organizationId, paidDate }) {
  return markInvoicePaid(cardId, year, month, organizationId, paidDate);
}

export async function moveInstallmentForUi({ cardId, chargeId, installmentId, organizationId, targetYear, targetMonth }) {
  return moveInstallmentToInvoice(cardId, chargeId, installmentId, organizationId, {
    target_year: targetYear,
    target_month: targetMonth,
  });
}

/**
 * Busca os itens de uma fatura de um mês específico (incluindo faturas fechadas).
 * Retorna array vazio se a fatura não existir (404) ou ocorrer erro.
 */
export async function fetchPastInvoiceItemsForUi(cardId, year, month, organizationId) {
  try {
    const invoice = await getCreditCardInvoice(cardId, year, month, organizationId);
    return (invoice?.items || []).map(mapInvoiceItemToUi);
  } catch {
    return [];
  }
}

export function formatCreditCardsApiError(error) {
  return handleApiError(error);
}

/* ─── UI helpers (CartoesPage) ────────────────────────────── */

/** Porcentagem segura (num/den). Retorna `fallback` se denominador for falsy ou divisão for NaN. */
export const safePctOrFallback = (num, den, fallback = 0) =>
  (!den || isNaN(num / den)) ? fallback : Math.round((num / den) * 100);

export const CARD_BRAND_OPTIONS = [
  "Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Visa Infinite", "Mastercard Black",
];

export function matchBrandToSelectOption(raw) {
  const r = String(raw ?? "").trim();
  const exact = CARD_BRAND_OPTIONS.find((o) => o.toLowerCase() === r.toLowerCase());
  if (exact) return exact;
  const lo = r.toLowerCase();
  if (lo.includes("infinite")) return "Visa Infinite";
  if (lo.includes("black")) return "Mastercard Black";
  if (lo.includes("master")) return "Mastercard";
  if (lo.includes("visa")) return "Visa";
  if (lo.includes("elo")) return "Elo";
  if (lo.includes("amex") || lo.includes("american")) return "Amex";
  if (lo.includes("hiper")) return "Hipercard";
  return CARD_BRAND_OPTIONS[0];
}

export function formatLimitInputFromNumber(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
