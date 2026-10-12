/** Number only when the amount is present and its currency matches the invoice. */
export function invoiceMoneyValue(value, currency) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    if (value.currency && currency && value.currency !== currency) return null;
    value = value.amount;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}
