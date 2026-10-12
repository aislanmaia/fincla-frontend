/**
 * Caminho do dashboard de uma fatura. Único ponto que conhece o formato:
 * quem linka (Hub do cartão) e quem registra a rota (finclaRouter) leem daqui.
 */
export const INVOICE_ROUTE_PATTERN = "cards/$cardId/invoices/$year/$month";
export const CARD_TRANSACTIONS_ROUTE_PATTERN = "cards/$cardId/invoices/$year/$month/transactions";
export const CARD_ALL_TRANSACTIONS_ROUTE_PATTERN = "cards/$cardId/transactions";

const PUBLIC_CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidPublicCardId = (cardId) => PUBLIC_CARD_ID.test(String(cardId ?? ""));

export function cardAllTransactionsPath(cardId) {
  return `/cards/${encodeURIComponent(String(cardId))}/transactions`;
}

export function invoiceDashboardPath(cardId, year, month) {
  return `/cards/${encodeURIComponent(String(cardId))}/invoices/${Number(year)}/${Number(month)}`;
}

export function cardTransactionsPath(cardId, year, month) {
  return `${invoiceDashboardPath(cardId, year, month)}/transactions`;
}

/** `year`/`month` da URL só valem como inteiros reais de calendário. */
export function isValidInvoiceParams({ cardId, year, month }) {
  const y = Number(year);
  const m = Number(month);
  return (
    isValidPublicCardId(cardId) &&
    Number.isInteger(y) && y >= 1900 && y <= 2100 &&
    Number.isInteger(m) && m >= 1 && m <= 12
  );
}

/**
 * Link para os Lançamentos do cartão já filtrados: `invoice` ({ year, month }), `categoryId`,
 * `query` (texto) e `kind` ("one_off" | "installment" | "recurring" | "refund"). Só entra o que veio.
 */
export function cardLedgerLink(cardId, { invoice, categoryId, query, kind } = {}) {
  const search = {};
  if (invoice?.year && invoice?.month) search.fc_inv = `${Number(invoice.year)}-${String(Number(invoice.month)).padStart(2, "0")}`;
  if (categoryId) search.fc_lcat = String(categoryId);
  if (query) search.fc_q = String(query);
  if (kind) search.fc_kind = kind;
  return { to: cardAllTransactionsPath(cardId), search };
}
