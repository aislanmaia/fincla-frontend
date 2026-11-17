// Rotas do Conciliar extrato (fincla-api#507) que outras telas abrem.
//
// O desfazer (fincla-api#509) é uma tela própria: a lista "Extratos importados" (#518) e o fim
// da conciliação apontam para ela por `statementImportUndoPath`.
export const STATEMENT_IMPORT_UNDO_ROUTE_PATTERN = "accounts/$accountId/reconcile/$importId/undo";

/** A conciliação da conta: o envio do extrato, ou o rascunho/importação `importId`. */
export function statementReconciliationPath(accountId, importId = null) {
  const account = `/accounts/${encodeURIComponent(accountId)}/reconcile`;
  return importId ? `${account}/${encodeURIComponent(importId)}` : account;
}

export function statementImportUndoPath(accountId, importId) {
  return `/accounts/${encodeURIComponent(accountId)}/reconcile/${encodeURIComponent(importId)}/undo`;
}

/**
 * A tela inicial da conta (sem `importId`), no computador, ocupa a altura que sobra na área de
 * conteúdo: a área grande de soltar estica em vez de deixar vazio embaixo (decisão do Owner,
 * 2026-11-17). Celular e as demais telas ficam como eram.
 */
export function fillsAvailableHeight(pathname, isMobile) {
  return !isMobile && /^\/accounts\/[^/]+\/reconcile\/?$/.test(pathname ?? "");
}
