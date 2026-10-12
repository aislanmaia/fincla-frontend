const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** A parcela única que a linha carrega, quando a compra é parcelada (2+). */
export function installmentOf(row) {
  const first = Array.isArray(row.installment_info) && row.installment_info.length === 1 ? row.installment_info[0] : null;
  return first && first.total_installments > 1 ? first : null;
}

/** Parcelas que ainda faltam depois desta; `null` quando a linha não é parcelada. */
export function remainingInstallments(row) {
  const part = installmentOf(row);
  return part ? Math.max(0, part.total_installments - part.installment_number) : null;
}

/**
 * Mês previsto da última parcela ("mar/27"), contando mês a mês a partir do vencimento
 * desta parcela. É uma previsão do cronograma regular: a listagem não traz as demais.
 */
export function forecastEnd(row) {
  const part = installmentOf(row);
  const base = String(part?.due_date || row.date || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(base);
  if (!part || !match) return null;
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + remainingInstallments(row);
  return `${MONTHS[index % 12]}/${String(Math.floor(index / 12)).slice(2)}`;
}

/**
 * Subtotal assinado de um grupo de linhas: despesa soma, estorno/receita abate.
 * `null` quando as linhas misturam moedas — somar moedas diferentes seria inventar um número.
 */
export function groupSubtotal(rows, cardCurrency) {
  const currencies = new Set(rows.map((row) => row.value_currency ?? cardCurrency ?? null));
  if (currencies.size !== 1) return null;
  const [currency] = [...currencies];
  if (!currency) return null;
  const amount = rows.reduce((sum, row) => sum + (row.type === "refund" || row.type === "income" ? -1 : 1) * Math.abs(Number(row.value) || 0), 0);
  return { amount, currency };
}
