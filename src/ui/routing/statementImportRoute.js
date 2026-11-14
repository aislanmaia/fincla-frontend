// Rotas do Conciliar extrato (fincla-api#507) que outras telas abrem.
//
// O desfazer (fincla-api#509) é uma tela própria: a lista "Extratos importados" (#518) e o fim
// da conciliação apontam para ela por `statementImportUndoPath`.
export const STATEMENT_IMPORT_UNDO_ROUTE_PATTERN = "accounts/$accountId/reconcile/$importId/undo";

export function statementImportUndoPath(accountId, importId) {
  return `/accounts/${encodeURIComponent(accountId)}/reconcile/${encodeURIComponent(importId)}/undo`;
}
