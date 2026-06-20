import {
  createTransaction,
  getTransactionsSummary,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "../../api/transactions";
import { downloadTransactionsCsv } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import { categoryLabelPtForTag } from "./categoryLabels.js";

/** Máximo por página na API `GET /transactions` (validação backend). */
export const TRANSACTIONS_API_MAX_LIMIT = 100;

const METHOD_LABELS = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  bank_transfer: "Transferência",
  boleto: "Boleto",
  credito: "Crédito",
  debito: "Débito",
  ted: "TED",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMethodLabel(value) {
  const normalized = normalizeText(value);
  return METHOD_LABELS[normalized] || value;
}

export function isUuidString(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isApiTagTypeCategory(t) {
  const n = normalizeText(t?.tag_type?.name || "");
  return n === "categoria" || n === "category";
}

function isCategoryTagGroupKey(groupKey) {
  const n = normalizeText(groupKey || "");
  return n.includes("categoria") || n.includes("category");
}

function pickCategoryTag(transaction) {
  const entries = Object.entries(transaction.tags ?? {});
  const categoryGroup = entries.find(([groupName, tags]) =>
    isCategoryTagGroupKey(groupName) || (tags ?? []).some(isApiTagTypeCategory),
  );

  if (categoryGroup?.[1]?.length) {
    return categoryGroup[1][0];
  }

  if (transaction.category) {
    return {
      id: null,
      name: transaction.category,
      icon_key: null,
      is_active: true,
    };
  }

  const firstTag = entries.flatMap(([, tags]) => tags ?? [])[0];
  return firstTag ?? null;
}

/**
 * Tag de categoria da transação (API), para agregações na UI.
 * @param {import("../../api/types").Transaction} transaction
 * @returns {{ id: string | null; name: string | null; icon_key: string | null; color: string | null } | null}
 */
export function pickCategoryTagFromApiTransaction(transaction) {
  const t = pickCategoryTag(transaction);
  if (!t) return null;
  return {
    id: t.id != null && t.id !== "" ? t.id : null,
    name: t.name ?? null,
    icon_key: t.icon_key ?? null,
    is_active: t.is_active !== false,
    color:
      typeof t.color === "string" && t.color.trim() ? t.color : null,
  };
}

export function pickDetailTagMetaMapFromApiTransaction(transaction) {
  const catTag = pickCategoryTag(transaction);
  const catId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  const map = {};
  for (const [groupKey, tags] of Object.entries(transaction.tags ?? {})) {
    if (isCategoryTagGroupKey(groupKey)) continue;
    for (const t of tags ?? []) {
      if (!t?.id) continue;
      if (isApiTagTypeCategory(t)) continue;
      const id = String(t.id);
      if (catId && id === catId) continue;
      if (
        catId &&
        t.parent_category_tag_id != null &&
        String(t.parent_category_tag_id).trim() !== "" &&
        String(t.parent_category_tag_id) !== catId
      ) {
        continue;
      }
      map[id] = {
        name:
          t.name != null && String(t.name).trim() !== ""
            ? String(t.name).trim()
            : `Tag ${id.slice(0, 8)}…`,
        isActive: t.is_active !== false,
      };
    }
  }
  return map;
}

function pickCategoryName(transaction) {
  const tag = pickCategoryTag(transaction);
  if (!tag) return "Sem categoria";
  return categoryLabelPtForTag(tag);
}

function pickTagNames(transaction, categoryDisplayName) {
  const catTag = pickCategoryTag(transaction);
  const catApiName = catTag?.name ?? categoryDisplayName;
  const primaryCatId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  return Object.entries(transaction.tags ?? {})
    .flatMap(([groupKey, tags]) =>
      (tags ?? []).map((tag) => ({ groupKey, tag })),
    )
    .filter(({ groupKey, tag }) => {
      if (isCategoryTagGroupKey(groupKey)) return false;
      if (isApiTagTypeCategory(tag)) return false;
      const name = tag?.name;
      if (!name || name === catApiName) return false;
      if (
        primaryCatId &&
        tag.parent_category_tag_id != null &&
        String(tag.parent_category_tag_id).trim() !== "" &&
        String(tag.parent_category_tag_id) !== primaryCatId
      ) {
        return false;
      }
      return true;
    })
    .map(({ tag }) => tag.name)
    .filter((tagName, index, all) => tagName && all.indexOf(tagName) === index);
}

/**
 * IDs de tags associadas à transação exceto a tag de categoria principal
 * (útil para POST/PUT com `tag_ids` e para pré-preencher o modal).
 * @param {import("../../api/types").Transaction} transaction
 * @returns {string[]}
 */
export function pickNonCategoryTagIdsFromApiTransaction(transaction) {
  const catTag = pickCategoryTag(transaction);
  const catId =
    catTag && catTag.id != null && String(catTag.id) !== ""
      ? String(catTag.id)
      : null;
  const out = [];
  const seen = new Set();
  for (const [groupKey, tags] of Object.entries(transaction.tags ?? {})) {
    if (isCategoryTagGroupKey(groupKey)) continue;
    for (const t of tags ?? []) {
      if (!t?.id) continue;
      if (isApiTagTypeCategory(t)) continue;
      const id = String(t.id);
      if (catId && id === catId) continue;
      if (
        catId &&
        t.parent_category_tag_id != null &&
        String(t.parent_category_tag_id).trim() !== "" &&
        String(t.parent_category_tag_id) !== catId
      ) {
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Rótulos API por id para tags não-categoria (para chips no modal mesmo quando
 * `GET /tags?tag_type=detalhe` não devolve todos os ids anexados à transação).
 * @param {import("../../api/types").Transaction} transaction
 * @returns {Record<string, string>}
 */
export function pickDetailTagDisplayMapFromApiTransaction(transaction) {
  const meta = pickDetailTagMetaMapFromApiTransaction(transaction);
  const map = {};
  for (const [id, row] of Object.entries(meta)) {
    map[id] = row.name;
  }
  return map;
}

function mergeTransactionTagIds(categoryTagId, detailTagIds) {
  const cat = categoryTagId != null ? String(categoryTagId) : "";
  const extras = Array.isArray(detailTagIds)
    ? detailTagIds.map((id) => String(id)).filter(Boolean)
    : [];
  const merged = cat ? [cat, ...extras.filter((id) => id !== cat)] : [...extras];
  return [...new Set(merged)];
}

function pickTransactionIcon(transaction) {
  if (transaction.type === "refund") return "↺";
  if (transaction.type === "income") return "💸";

  const method = normalizeText(transaction.payment_method);
  if (method === "credit_card" || method.includes("credito")) return "💳";
  if (method === "debit_card" || method.includes("debito")) return "💸";
  if (method === "pix" || method.includes("pix")) return "⚡";
  if (method === "boleto" || method.includes("boleto")) return "🧾";
  if (method === "cash" || method.includes("dinheiro")) return "💵";
  if (method === "bank_transfer" || method.includes("transfer")) return "🏦";
  return "🧾";
}

function mapInstallmentInfo(transaction) {
  const installment = transaction.installment_info?.[0];
  if (!installment) return null;

  // Occurrence-based: each installment is its own transaction; the purchase total is
  // derived from the installment value × count (installments are equal-split).
  const total = Number((installment.amount * installment.total_installments).toFixed(2));
  const paid = Number((installment.amount * installment.installment_number).toFixed(2));
  return {
    atual: installment.installment_number,
    total: installment.total_installments,
    valParcela: installment.amount,
    cartao: "",
    vencimento: formatDate(installment.due_date),
    valorTotal: total,
    valorPago: paid,
    valorResidual: Number((total - paid).toFixed(2)),
  };
}

/** Valor exibido na linha (soma das parcelas em `installment_info` quando houver). */
export function pickDisplayAmount(transaction) {
  const parts = transaction.installment_info;
  if (parts?.length) {
    return parts.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }
  return Number(transaction.value ?? 0);
}

/** Valor absoluto para o modal de edição; na lista usa-se pickDisplayAmount. */
export function pickAmountAbsForTransactionEdit(transaction) {
  if (!transaction) return 0;
  // Occurrence-based: an installment carries its own value; the purchase total for
  // the edit modal is value × installment count.
  const installment = transaction.installment_info?.[0];
  if (installment && installment.total_installments > 1) {
    const total = Number(installment.amount) * Number(installment.total_installments);
    if (Number.isFinite(total)) return Math.abs(total);
  }
  const v = Number(transaction.value ?? 0);
  return Number.isFinite(v) ? Math.abs(v) : 0;
}

export function transactionUiValAbsForEdit(ui) {
  if (!ui || typeof ui !== "object") return 0;
  for (const x of [ui.valAbsForEdit, ui.parcela?.valorTotal, ui.val]) {
    if (x != null && x !== "") {
      const n = Number(x);
      if (Number.isFinite(n)) return Math.abs(n);
    }
  }
  return 0;
}

/**
 * Data bruta para coluna «Data» na lista (GET /transactions com período):
 * cartão à vista → data da compra; parcelado → vencimento da primeira parcela retornada no período.
 * @param {import("../../api/types").Transaction} transaction
 */
export function pickTransactionListDateRawForDisplay(transaction) {
  // Occurrence-based: the transaction's own `date` is already the effective date
  // (cash → purchase date; installment → its due date).
  return transaction.date;
}

/**
 * Despesas atribuídas a dias (ritmo, médias por weekday, etc.), alinhado ao contrato de listagem.
 * Parcelado: uma entrada por item em `installment_info`; demais: uma entrada na data da transação.
 * @param {import("../../api/types").Transaction} transaction
 * @returns {{ date: string; amount: number }[]}
 */
export function expandExpenseTxToAttributedParts(transaction) {
  if (transaction.type !== "expense") return [];
  // Occurrence-based: each installment is its own transaction attributed to its own
  // date, so a single entry per transaction is correct.
  const amount = pickDisplayAmount(transaction);
  const ymd =
    ymdFromAnyDateInput(transaction.date) ||
    String(transaction.date ?? "").slice(0, 10);
  return ymd ? [{ date: ymd, amount }] : [];
}

export function mapApiTransactionToUi(transaction) {
  const catTag = pickCategoryTag(transaction);
  const categoryName = catTag ? categoryLabelPtForTag(catTag) : "Sem categoria";
  const detailTagMetaById = pickDetailTagMetaMapFromApiTransaction(transaction);
  const amount = pickDisplayAmount(transaction);
  // Refund é dinheiro voltando — sinal positivo como income.
  const isMoneyIn = transaction.type === "income" || transaction.type === "refund";
  const signedVal = isMoneyIn ? amount : -amount;

  let statusLabel = "confirmado";
  if (transaction.status === "pending") statusLabel = "pendente";
  else if (transaction.status === "cancelled") statusLabel = "cancelada";

  const listDateRaw = pickTransactionListDateRawForDisplay(transaction);
  const dateLabel = formatDate(listDateRaw);

  const cardIdFromCharge = transaction.credit_card_id ?? null;

  return {
    id: transaction.id,
    desc: transaction.description,
    cat: categoryName,
    categoryTagId: catTag?.id ?? null,
    categoryTagIsActive: catTag?.is_active !== false,
    categoryIconKey: catTag?.icon_key ?? null,
    date: dateLabel,
    dateIsoForEdit: pickDateIsoForEditTransaction(transaction),
    paymentMethodKey: mapApiPaymentMethodToModalKey(transaction.payment_method),
    cartaoId: cardIdFromCharge != null && Number.isFinite(Number(cardIdFromCharge))
      ? Number(cardIdFromCharge)
      : null,
    val: signedVal,
    valAbsForEdit: pickAmountAbsForTransactionEdit(transaction),
    icon: pickTransactionIcon(transaction),
    rec: transaction.recurring,
    seriesId: transaction.series_id ?? null,
    status: statusLabel,
    method: formatMethodLabel(transaction.payment_method),
    tags: pickTagNames(transaction, categoryName),
    detailTagIds: pickNonCategoryTagIdsFromApiTransaction(transaction),
    detailTagDisplayById: pickDetailTagDisplayMapFromApiTransaction(transaction),
    detailTagMetaById,
    parcela: mapInstallmentInfo(transaction),
    // Tipo bruto do backend — UI usa pra renderizar badge/avatar de estorno.
    type: transaction.type,
    // FK opcional pra compra original (só vem populado quando type === "refund").
    refundOfTransactionId: transaction.refund_of_transaction_id ?? null,
    // Resumo agregado dos estornos linkados a esta transação (count + total_value).
    refundsSummary: transaction.refunds_summary
      ? {
          count: Number(transaction.refunds_summary.count) || 0,
          totalValue: Number(transaction.refunds_summary.total_value) || 0,
        }
      : null,
  };
}

function resolveDateRange(period, customFrom, customTo) {
  const today = new Date();

  if (period === "hoje") {
    const current = formatLocalIsoDate(today);
    return { date_start: current, date_end: current };
  }

  if (period === "semana") {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  if (period === "mes") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(end),
    };
  }

  if (period === "mes-ant") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(end),
    };
  }

  if (period === "3m") {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  if (period === "ano") {
    const start = new Date(today.getFullYear(), 0, 1);
    return {
      date_start: formatLocalIsoDate(start),
      date_end: formatLocalIsoDate(today),
    };
  }

  if (period === "custom" && (customFrom || customTo)) {
    return {
      ...(customFrom ? { date_start: customFrom } : {}),
      ...(customTo ? { date_end: customTo } : {}),
    };
  }

  return {};
}

function resolveSort(sortBy) {
  if (sortBy === "date-asc") return { sort_by: "date", sort_order: "asc" };
  if (sortBy === "val-desc") return { sort_by: "value", sort_order: "desc" };
  if (sortBy === "val-asc") return { sort_by: "value", sort_order: "asc" };
  if (sortBy === "name-asc") return { sort_by: "description", sort_order: "asc" };
  if (sortBy === "name-desc") return { sort_by: "description", sort_order: "desc" };
  return { sort_by: "date", sort_order: "desc" };
}

export function buildTransactionsQuery({
  organizationId,
  search = "",
  filterType = "todos",
  filterCat = "todas",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
  sortBy = "date-desc",
  valueMin,
  valueMax,
  limit = 10,
}) {
  const categoryFilter =
    filterCat !== "todas"
      ? isUuidString(filterCat)
        ? { tag_id: filterCat }
        : { category: filterCat }
      : {};

  return {
    organization_id: organizationId,
    ...(search ? { description: search } : {}),
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...categoryFilter,
    ...(filterMethod !== "todos" ? { payment_method: filterMethod } : {}),
    ...resolveDateRange(period, customFrom, customTo),
    ...(valueMin != null ? { value_min: valueMin } : {}),
    ...(valueMax != null ? { value_max: valueMax } : {}),
    page: 1,
    limit,
    ...resolveSort(sortBy),
  };
}

/**
 * Busca candidatas pra linkar como "compra estornada" no drawer.
 *
 * Filtra expenses recentes (últimos 365 dias) pela API; pode estreitar por
 * payment_method e — quando o usuário já escolheu cartão — por cardId
 * client-side (a API atual não suporta filtro por card_id direto).
 *
 * Retorna array de objetos no formato de UI (mapApiTransactionToUi) ordenado
 * por data desc, máximo `limit` itens.
 */
export async function fetchRefundCandidates({
  organizationId,
  query = "",
  paymentMethodKey = null,
  cardId = null,
  limit = 8,
}) {
  if (!organizationId) return [];
  const today = new Date();
  const since = new Date(today.getTime() - 365 * 86400000);
  const params = {
    organization_id: organizationId,
    type: "expense",
    date_start: formatLocalIsoDate(since),
    date_end: formatLocalIsoDate(today),
    page: 1,
    limit: cardId != null ? Math.max(limit * 3, 24) : limit,
    sort_by: "date",
    sort_order: "desc",
  };
  const search = String(query || "").trim();
  if (search) params.description = search;
  if (paymentMethodKey) {
    const apiMethod = mapUiPaymentMethodToApi(paymentMethodKey);
    if (apiMethod) params.payment_method = apiMethod;
  }
  let response;
  try {
    response = await listTransactions(params);
  } catch (_err) {
    return [];
  }
  const rows = (response?.data || []).map(mapApiTransactionToUi);
  const filtered = cardId != null
    ? rows.filter((t) => t.cartaoId != null && Number(t.cartaoId) === Number(cardId))
    : rows;
  return filtered.slice(0, limit);
}

export function buildTransactionsCsvOptions({
  filterType = "todos",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
}) {
  const dateRange = resolveDateRange(period, customFrom, customTo);

  return {
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...(filterMethod !== "todos" ? { paymentMethod: filterMethod } : {}),
    ...(dateRange.date_start ? { dateStart: dateRange.date_start } : {}),
    ...(dateRange.date_end ? { dateEnd: dateRange.date_end } : {}),
  };
}

export function buildTransactionsSummaryQuery({
  organizationId,
  search = "",
  filterType = "todos",
  filterCat = "todas",
  filterMethod = "todos",
  period = "tudo",
  customFrom = "",
  customTo = "",
  valueMin,
  valueMax,
}) {
  const categoryFilter =
    filterCat !== "todas"
      ? isUuidString(filterCat)
        ? { tag_id: filterCat }
        : { category: filterCat }
      : {};

  return {
    organization_id: organizationId,
    ...(search ? { description: search } : {}),
    ...(filterType === "receita" ? { type: "income" } : {}),
    ...(filterType === "despesa" ? { type: "expense" } : {}),
    ...(filterType === "estorno" ? { type: "refund" } : {}),
    ...categoryFilter,
    ...(filterMethod !== "todos" ? { payment_method: filterMethod } : {}),
    ...resolveDateRange(period, customFrom, customTo),
    ...(valueMin != null ? { value_min: valueMin } : {}),
    ...(valueMax != null ? { value_max: valueMax } : {}),
  };
}

/**
 * Lista todas as transações que casam com o filtro, paginando em lotes de até
 * {@link TRANSACTIONS_API_MAX_LIMIT} até esgotar `has_next`.
 */
export async function fetchAllTransactionsPages(baseQuery) {
  const all = [];
  let page = 1;
  let lastRes = null;

  for (;;) {
    lastRes = await listTransactions({
      ...baseQuery,
      limit: TRANSACTIONS_API_MAX_LIMIT,
      page,
    });
    const batch = lastRes.data ?? [];
    all.push(...batch);
    if (!lastRes.pagination?.has_next || batch.length === 0) break;
    page += 1;
    if (page > 1000) break;
  }

  return { data: all, pagination: lastRes?.pagination };
}

export async function listTransactionsForUi(query) {
  const page = query.page ?? 1;
  const wantRaw = query.limit ?? 10;
  const want = Math.max(1, wantRaw);

  if (want <= TRANSACTIONS_API_MAX_LIMIT && page === 1) {
    return listTransactions({
      ...query,
      limit: want,
      page: 1,
    });
  }

  const { page: _p, limit: _l, ...base } = query;
  const all = [];
  let currentPage = 1;
  let lastRes = null;

  while (all.length < want) {
    lastRes = await listTransactions({
      ...base,
      limit: TRANSACTIONS_API_MAX_LIMIT,
      page: currentPage,
    });
    const batch = lastRes.data ?? [];
    all.push(...batch);
    if (!lastRes.pagination?.has_next || batch.length === 0) break;
    currentPage += 1;
    if (currentPage > 1000) break;
  }

  const total = lastRes?.pagination?.total ?? all.length;
  return {
    data: all.slice(0, want),
    pagination: lastRes?.pagination
      ? {
          ...lastRes.pagination,
          has_next: total > want,
        }
      : undefined,
  };
}

export async function getTransactionsSummaryForUi(query) {
  return getTransactionsSummary(query);
}

export async function deleteTransactionForUi(transactionId, organizationId) {
  return deleteTransaction(transactionId, organizationId);
}

export async function downloadTransactionsCsvForUi(organizationId, options) {
  return downloadTransactionsCsv(organizationId, options, "transacoes.csv");
}

export function formatTransactionsApiError(error) {
  return handleApiError(error);
}

const MODAL_METHOD_TO_API = {
  pix: "pix",
  boleto: "boleto",
  dinheiro: "cash",
  debito: "debit_card",
  credito: "credit_card",
  transferencia: "bank_transfer",
};

export function mapUiPaymentMethodToApi(methodKey) {
  return MODAL_METHOD_TO_API[methodKey] ?? methodKey;
}

/** Inverso de `mapUiPaymentMethodToApi` para pré-preencher o modal a partir da API. */
export function mapApiPaymentMethodToModalKey(apiMethod) {
  const key = String(apiMethod || "").trim();
  for (const [modalKey, apiKey] of Object.entries(MODAL_METHOD_TO_API)) {
    if (apiKey === key) return modalKey;
  }
  const n = normalizeText(key);
  const found = Object.entries(MODAL_METHOD_TO_API).find(
    ([, v]) => normalizeText(v) === n,
  );
  return found ? found[0] : "pix";
}

/** Lista / mock: usa `paymentMethodKey` da API ou heurística no rótulo PT. */
export function modalPaymentKeyFromTransactionUi(tx) {
  if (tx?.paymentMethodKey) return tx.paymentMethodKey;
  const s = String(tx?.method || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (s.includes("credito")) return "credito";
  if (s.includes("debito")) return "debito";
  if (s.includes("pix")) return "pix";
  if (s.includes("ted") || s.includes("transfer")) return "transferencia";
  if (s.includes("boleto")) return "boleto";
  if (s.includes("dinheiro")) return "dinheiro";
  return "pix";
}

/** `DD/MM/AAAA` (mock) → ISO `YYYY-MM-DDTHH:mm:ss` para o campo Data do modal; inválido → null. */
export function transactionDateIsoFromBrDisplay(display) {
  const parts = String(display || "").split("/");
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!dd || !mm || !yyyy || yyyy < 1900) return null;
  const y = String(yyyy).padStart(4, "0");
  const m = String(mm).padStart(2, "0");
  const d = String(dd).padStart(2, "0");
  return `${y}-${m}-${d}T12:00:00`;
}

/** Data local do dia (YYYY-MM-DD). */
export function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function novaTxDateStorageKey(organizationId) {
  return `fincla.v2.novaTxDate.${organizationId || "default"}`;
}

/** Lê última data escolhida no modal Nova transação (por organização). */
export function readStoredNovaTransacaoDate(organizationId) {
  try {
    const v = localStorage.getItem(novaTxDateStorageKey(organizationId));
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch (_) {}
  return null;
}

/** Persiste última data escolhida (YYYY-MM-DD). */
export function writeStoredNovaTransacaoDate(organizationId, ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
  try {
    localStorage.setItem(novaTxDateStorageKey(organizationId), ymd);
  } catch (_) {}
}

function novaTxPrefsStorageKey(organizationId) {
  return `fincla.v2.novaTxPrefs.${organizationId || "default"}`;
}

/** Últimas escolhas do modal Nova transação (forma de pagamento, categoria, cartão/modalidade). */
export function readStoredNovaTransacaoPrefs(organizationId) {
  try {
    const raw = localStorage.getItem(novaTxPrefsStorageKey(organizationId));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}

export const NOVA_TX_METHODS_DESPESA = [
  "pix",
  "debito",
  "credito",
  "dinheiro",
  "boleto",
];

export const NOVA_TX_METHODS_RECEITA = ["pix", "dinheiro", "transferencia"];

export function normalizeStoredNovaTxPaymentMethod(method, tipo) {
  const list =
    tipo === "receita" ? NOVA_TX_METHODS_RECEITA : NOVA_TX_METHODS_DESPESA;
  const m = String(method ?? "").trim();
  return list.includes(m) ? m : null;
}

export function clampNovaTxPrefsParcelas(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const r = Math.round(x);
  if (r < 1 || r > 360) return null;
  return r;
}

/**
 * Objeto persistido em JSON — modalidade/parcelas/cartão só quando method é crédito.
 */
export function serializeNovaTxFormStateToStoredPrefs({
  tipo,
  method,
  cat,
  categoryTagId,
  modalidade,
  parcelas,
  cartao,
}) {
  const t = tipo === "receita" ? "receita" : "despesa";
  const pm = normalizeStoredNovaTxPaymentMethod(method, t);
  const effectiveMethod = pm ?? "pix";
  const catStr = cat != null ? String(cat).trim() : "";
  const catId =
    categoryTagId != null && isUuidString(String(categoryTagId))
      ? String(categoryTagId)
      : null;

  const base = {
    tipo: t,
    method: effectiveMethod,
    cat: catStr ? catStr : null,
    categoryTagId: catId,
    modalidade: null,
    parcelas: null,
    cartaoId: null,
  };

  if (effectiveMethod !== "credito") return base;

  const parcelasClamped = clampNovaTxPrefsParcelas(parcelas) ?? 3;
  const mod = modalidade === "avista" ? "avista" : "parcelado";
  const cid =
    cartao != null &&
    String(cartao).trim() !== "" &&
    String(cartao) !== "novo"
      ? String(cartao).trim()
      : null;

  return {
    ...base,
    modalidade: mod,
    parcelas: parcelasClamped,
    cartaoId: cid,
  };
}

export function writeStoredNovaTransacaoPrefs(organizationId, prefsObject) {
  try {
    localStorage.setItem(
      novaTxPrefsStorageKey(organizationId),
      JSON.stringify(prefsObject),
    );
  } catch (_) {}
}

/** Edição ou pré-config explícita de categoria: não aplicar prefs armazenadas à lista de categorias. */
export function shouldApplyStoredNovaTxCategoryPrefs(preConfig) {
  const editing =
    preConfig?.editingTransactionId != null &&
    String(preConfig.editingTransactionId).trim() !== "";
  if (editing) return false;
  if (!preConfig) return true;
  if (
    preConfig.categoryTagId != null &&
    isUuidString(String(preConfig.categoryTagId))
  )
    return false;
  if (preConfig.cat != null && String(preConfig.cat).trim() !== "")
    return false;
  return true;
}

/** Extrai YYYY-MM-DD de ISO ou string de data. */
export function ymdFromAnyDateInput(value) {
  if (value == null || value === "") return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function pickDateIsoForEditTransaction(transaction) {
  for (const value of [transaction.date]) {
    if (value == null || String(value).trim() === "") continue;
    const ymd = ymdFromAnyDateInput(value);
    if (ymd) return `${ymd}T12:00:00`;
  }
  return `${todayLocalYmd()}T12:00:00`;
}

/** Data inicial do campo Data: preConfig, senão última salva, senão hoje. */
export function initialNovaTransacaoDateYmd(organizationId, preConfig) {
  const fromPc = preConfig && ymdFromAnyDateInput(preConfig.dateIso ?? preConfig.transactionDate);
  if (fromPc) return fromPc;
  return readStoredNovaTransacaoDate(organizationId) ?? todayLocalYmd();
}

/** Formata `YYYY-MM-DD` para exibição conforme `locale` (BCP 47). */
export function formatYmdToLocaleDisplay(ymd, locale = "pt-BR") {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  } catch {
    return dt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
}

/** @deprecated Prefira `formatYmdToLocaleDisplay(ymd, locale)` ou `APP_UI_LOCALE`. */
export function formatYmdToBrDisplay(ymd) {
  return formatYmdToLocaleDisplay(ymd, "pt-BR");
}

/** Data local do dia, meio-dia (ISO sem timezone shift agressivo). */
export function defaultTransactionDateIso() {
  return `${todayLocalYmd()}T12:00:00`;
}

/** ISO `YYYY-MM-DDTHH:mm:ss` para API a partir de YYYY-MM-DD. */
export function transactionDateIsoFromYmd(ymd) {
  const y = ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : todayLocalYmd();
  return `${y}T12:00:00`;
}

/**
 * Payload mínimo para POST /transactions (tag_ids obrigatório).
 * Parcelas/cartão: opcionais conforme o backend aceitar.
 */
export function buildCreateTransactionPayload({
  organizationId,
  tipo,
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  dateIso,
  cardId = null,
  installmentsCount = null,
  modality = null,
  refundOfTransactionId = null,
  accountId = null,
  paidAt = null,
}) {
  let type;
  if (tipo === "receita") type = "income";
  else if (tipo === "estorno" || tipo === "refund") type = "refund";
  else type = "expense";

  const payload = {
    organization_id: organizationId,
    type,
    description: String(description || "").trim() || "—",
    tag_ids: mergeTransactionTagIds(categoryTagId, detailTagIds),
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    date: dateIso,
  };
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.card_id = Number(cardId);
  }
  // Refund em cartão: backend força modality='refund' e installments=1 — não envie nada extra.
  if (type === "refund") {
    if (refundOfTransactionId != null && Number.isFinite(Number(refundOfTransactionId))) {
      payload.refund_of_transaction_id = Number(refundOfTransactionId);
    }
  } else {
    if (modality) payload.modality = modality;
    if (
      modality === "installment" &&
      installmentsCount != null &&
      Number(installmentsCount) >= 1
    ) {
      payload.installments_count = Number(installmentsCount);
    }
  }
  // Fase 0 (cash model): conta de liquidação + settlement opcional.
  // Omitir account_id => backend usa a conta default; omitir paid_at => compromisso pendente.
  if (accountId) payload.account_id = accountId;
  if (paidAt) payload.paid_at = paidAt;
  return payload;
}

/**
 * Corpo para `PUT /transactions/:id` (sem `organization_id` no body).
 * Despesa em cartão: envie `card_id` (como no POST); não envie `card_last4` — não basta para cobrança/parcelas.
 */
export function buildUpdateTransactionPayload({
  tipo,
  description,
  value,
  paymentMethodKey,
  categoryTagId,
  detailTagIds = null,
  dateIso,
  cardId = null,
  installmentsCount = null,
  modality = null,
  recurring = false,
}) {
  let type;
  if (tipo === "receita") type = "income";
  else if (tipo === "estorno" || tipo === "refund") type = "refund";
  else type = "expense";
  const payload = {
    type,
    description: String(description || "").trim() || "—",
    value: Number(value),
    payment_method: mapUiPaymentMethodToApi(paymentMethodKey),
    date: dateIso,
    recurring: !!recurring,
  };
  // Só sobrescreve tags se houver um ID válido; caso contrário, a API mantém as existentes.
  if (categoryTagId != null) {
    payload.tag_ids = mergeTransactionTagIds(categoryTagId, detailTagIds);
  }
  if (cardId != null && Number.isFinite(Number(cardId))) {
    payload.card_id = Number(cardId);
  }
  // Refund em cartão: backend força modality='refund' e installments=1 — não envie.
  if (type !== "refund") {
    if (modality) payload.modality = modality;
    if (
      modality === "installment" &&
      installmentsCount != null &&
      Number(installmentsCount) >= 1
    ) {
      payload.installments_count = Number(installmentsCount);
    }
  }
  return payload;
}

export async function createTransactionForUi(payload) {
  return createTransaction(payload);
}

export async function updateTransactionForUi(transactionId, organizationId, payload) {
  return updateTransaction(transactionId, organizationId, payload);
}
