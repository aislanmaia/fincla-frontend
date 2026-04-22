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
};

/** Valores de `fc_modal` (inglês, partilháveis). */
export const FC_MODAL = {
  NEW_TRANSACTION: "new-transaction",
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
  delete next[FC.SIM_OPEN];
  delete next[FC.SIM_ITEM];
  delete next[FC.MODAL];
  delete next[FC.TX];
  delete next[FC.CARD];

  if (opts.filterCat != null && String(opts.filterCat).trim() !== "") {
    next[FC.CATEGORY] = String(opts.filterCat).trim();
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
