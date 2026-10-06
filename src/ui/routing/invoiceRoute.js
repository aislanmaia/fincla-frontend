/**
 * Caminho do dashboard de uma fatura. Único ponto que conhece o formato:
 * quem linka (Hub do cartão) e quem registra a rota (finclaRouter) leem daqui.
 */
export const INVOICE_ROUTE_PATTERN = "cards/$cardId/invoices/$year/$month";

const PUBLIC_CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function invoiceDashboardPath(cardId, year, month) {
  return `/cards/${encodeURIComponent(String(cardId))}/invoices/${Number(year)}/${Number(month)}`;
}

/** `year`/`month` da URL só valem como inteiros reais de calendário. */
export function isValidInvoiceParams({ cardId, year, month }) {
  const y = Number(year);
  const m = Number(month);
  return (
    PUBLIC_CARD_ID.test(String(cardId ?? "")) &&
    Number.isInteger(y) && y >= 1900 && y <= 2100 &&
    Number.isInteger(m) && m >= 1 && m <= 12
  );
}
