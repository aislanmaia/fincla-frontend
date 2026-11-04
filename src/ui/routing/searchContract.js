/**
 * Contrato de query da app (prefixo `fc_` para não colidir com tokens de e-mail na raiz).
 * @see docs/FRONTEND_AUTH_INVITE_LINKS.md — parâmetros de convite/reset ficam fora do prefixo.
 *
 * Allowlist: só chaves listadas em `finclaRootSearchSchema` entram no estado tipado; o resto é descartado no parse Zod.
 * Separadores de Configurações usam path (`/profile/account`, …), não `fc_*`.
 */

export const FC = {
  MODAL: "fc_modal",
  TX: "fc_tx",
  CARD: "fc_card",
  CATEGORY: "fc_category",
  ADD: "fc_add",
  SIM_OPEN: "fc_sim_open",
  SIM_ITEM: "fc_sim_item_type",
  // Calendário v2 — estado partilhável/deep-linkável na URL.
  CAL_MONTH: "fc_cal_m", // "YYYY-MM" (mês visível)
  CAL_DAY: "fc_cal_d", // "YYYY-MM-DD" (dia selecionado)
  CAL_VIEW: "fc_cal_v", // "week" | "month"
  CAL_HIDE: "fc_cal_hide", // tipos ocultos: "income" | "expense" | "income,expense"
  CAL_PAY: "fc_cal_pay", // formas de pagamento ocultas (csv)
  DATE: "fc_date", // "YYYY-MM-DD" — filtro de dia no /transactions
  // Deep link de filtros dos Lançamentos (/transactions) — ver docs/FRONTEND_TRANSACTIONS_DEEP_LINK.md.
  TX_FROM: "fc_from", // "YYYY-MM-DD" — início do período (exige fc_to)
  TX_TO: "fc_to", // "YYYY-MM-DD" — fim do período (>= fc_from)
  TX_TYPE: "fc_type", // "expense" | "income"
  TX_STATUS: "fc_status", // "paid" | "to_pay"
  TX_ACCOUNT: "fc_account", // UUID(s) de conta, separados por vírgula — filtro "Conta" (#268)
  // Sem prefixo `fc_` de propósito: é o contrato público `/cards?view=new` do Hub de Cartões.
  VIEW: "view",
  HUB_CARD: "card",
  INVOICE_MODALITY: "fc_invoice_modality",
  // Deep link para os Lançamentos do cartão (`/cards/:id/transactions`): fatura, categoria, busca e tipo.
  LEDGER_INVOICE: "fc_inv", // "YYYY-MM" — a fatura
  LEDGER_CATEGORY: "fc_lcat", // id da categoria no catálogo
  LEDGER_SEARCH: "fc_q", // texto da busca
  LEDGER_KIND: "fc_kind", // "one_off" | "installment" | "recurring" | "refund"
};

/** `true` só para `YYYY-MM-DD` que existe no calendário (rejeita 2026-02-31, 2026-13-01). */
export function isRealYmd(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Valores de `fc_modal` (inglês, partilháveis). */
export const FC_MODAL = {
  NEW_TRANSACTION: "new-transaction",
  NEW_REFUND: "new-refund",
  EDIT_TRANSACTION: "edit-transaction",
  NEW_RECURRING: "new-recurring",
};

/** Tipos de item da simulação na URL (inglês) ↔ ids internos do modal `SimulacaoPage`. */
const SIM_URL_TO_INTERNAL = {
  recurring_expense: "despesa_recorrente",
  installment_expense: "despesa_parcelada",
  recurring_income: "receita_recorrente",
  oneoff_income: "receita_pontual",
  category_adjustment: "ajuste_categoria",
};

const SIM_INTERNAL_TO_URL = Object.fromEntries(
  Object.entries(SIM_URL_TO_INTERNAL).map(([url, internal]) => [internal, url]),
);

export function simulationTipoFromUrl(urlTipo) {
  if (!urlTipo || typeof urlTipo !== "string") return null;
  return SIM_URL_TO_INTERNAL[urlTipo.trim()] ?? null;
}

export function simulationTipoToUrl(internalTipo) {
  if (!internalTipo || typeof internalTipo !== "string") return undefined;
  return SIM_INTERNAL_TO_URL[internalTipo] ?? undefined;
}

/**
 * Search que abre o Painel de Transação (edição) de um lançamento, preservando o resto da URL.
 * Um único lugar para a regra `fc_tx` + `fc_modal=edit-transaction` que Calendário e Lançamentos repetiam.
 */
export function editTransactionSearch(previous, transactionId) {
  return { ...previous, [FC.TX]: String(transactionId), [FC.MODAL]: FC_MODAL.EDIT_TRANSACTION };
}

/**
 * Ao mudar de rota principal via `navTo`, limpa one-shots e reaplica `opts`.
 * Preserva chaves de auth (`invite_token`, …) e `fc_*` não listados aqui (futuro).
 * @param {Record<string, unknown>} previous — search já validado (saída Zod)
 * @param {string} _targetSegment — segmento destino (reservado p. políticas por rota)
 * @param {Record<string, unknown>} opts — `filterCat` (fc_category), `autoOpenAdd` (fc_add em /budgets, /cards, /goals), `autoOpenModal`+`autoTipo` (simulação: fc_sim_open + fc_sim_item), `cenarioId` (estado React)
 */
export function mergeNavSearch(previous, _targetSegment, opts = {}) {
  const next = { ...previous };
  delete next[FC.ADD];
  delete next[FC.CATEGORY];
  // Filtros de deep link dos Lançamentos não vazam para outras telas (nem voltam sozinhos ao reabrir /transactions).
  delete next[FC.TX_FROM];
  delete next[FC.TX_TO];
  delete next[FC.TX_TYPE];
  delete next[FC.TX_STATUS];
  delete next[FC.TX_ACCOUNT];
  delete next[FC.SIM_OPEN];
  delete next[FC.SIM_ITEM];
  delete next[FC.MODAL];
  delete next[FC.TX];
  delete next[FC.CARD];
  delete next[FC.VIEW];
  delete next[FC.HUB_CARD];
  delete next[FC.LEDGER_INVOICE];
  delete next[FC.LEDGER_CATEGORY];
  delete next[FC.LEDGER_SEARCH];
  delete next[FC.LEDGER_KIND];

  if (opts.filterCat != null && String(opts.filterCat).trim() !== "") {
    next[FC.CATEGORY] = String(opts.filterCat).trim();
  }
  // Minhas Contas → /transactions já filtrado naquela conta (#268).
  if (opts.accountId != null && String(opts.accountId).trim() !== "") {
    next[FC.TX_ACCOUNT] = String(opts.accountId).trim();
  }
  if (opts.autoOpenAdd) {
    next[FC.ADD] = "1";
  }
  if (opts.autoOpenModal && opts.autoTipo) {
    next[FC.SIM_OPEN] = "1";
    const urlTipo = simulationTipoToUrl(opts.autoTipo);
    if (urlTipo) next[FC.SIM_ITEM] = urlTipo;
  }
  return next;
}
