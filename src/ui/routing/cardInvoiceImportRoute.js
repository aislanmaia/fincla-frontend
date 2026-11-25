// Rota do Conciliar fatura (fincla-api#554/#555). A URL usa o `public_id` do cartão; a API, o `id`.
export const CARD_INVOICE_RECONCILIATION_ROUTE_PATTERN = "cards/$cardId/reconcile/{-$importId}";
// O desfazer (fincla-api#556) é uma tela própria, como o do extrato (#509).
export const CARD_INVOICE_UNDO_ROUTE_PATTERN = "cards/$cardId/reconcile/$importId/undo";

/** A conciliação da fatura: o envio do PDF, ou o rascunho/conciliação `importId`. */
export function cardInvoiceReconciliationPath(cardPublicId, importId = null) {
  const card = `/cards/${encodeURIComponent(String(cardPublicId))}/reconcile`;
  return importId ? `${card}/${encodeURIComponent(importId)}` : card;
}

/** O desfazer de uma conciliação de fatura concluída. */
export function cardInvoiceUndoPath(cardPublicId, importId) {
  return `${cardInvoiceReconciliationPath(cardPublicId, importId)}/undo`;
}
