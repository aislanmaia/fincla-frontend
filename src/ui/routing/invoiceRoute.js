/**
 * Caminho do dashboard de uma fatura. Único ponto que conhece o formato:
 * quem linka (Hub do cartão) e quem registra a rota (finclaRouter) leem daqui.
 */
export const INVOICE_ROUTE_PATTERN = "cards/$cardId/invoices/$year/$month";

export function invoiceDashboardPath(cardId, year, month) {
  return `/cards/${encodeURIComponent(String(cardId))}/invoices/${Number(year)}/${Number(month)}`;
}

/** `year`/`month` da URL só valem como inteiros reais de calendário. */
export function isValidInvoiceParams({ cardId, year, month }) {
  const y = Number(year);
  const m = Number(month);
  return (
    String(cardId ?? "").trim() !== "" &&
    Number.isInteger(y) && y >= 1900 && y <= 2100 &&
    Number.isInteger(m) && m >= 1 && m <= 12
  );
}
