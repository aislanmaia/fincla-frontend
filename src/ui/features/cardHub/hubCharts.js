import { invoiceKey, parseInvoiceKey } from "./hubInvoices.js";

function offsetMonth(key, offset) {
  const parsed = parseInvoiceKey(key);
  if (!parsed) return null;
  const date = new Date(parsed.year, parsed.month - 1 + offset, 1);
  return invoiceKey(date.getFullYear(), date.getMonth() + 1);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function historyPoints(invoices, anchorKey, isMobile) {
  const start = isMobile ? -2 : -5;
  const byKey = new Map(invoices.map((invoice) => [invoice.key, invoice]));
  const window = Array.from({ length: isMobile ? 6 : 9 }, (_, index) => {
    const key = offsetMonth(anchorKey, start + index);
    const invoice = byKey.get(key);
    return {
      key,
      month: parseInvoiceKey(key)?.month,
      status: invoice?.status ?? null,
      total: numberOrNull(invoice?.total),
      current: key === anchorKey,
    };
  });
  const firstInvoice = window.findIndex((point) => point.total !== null);
  return firstInvoice < 0 ? [] : window.slice(firstInvoice);
}

export function categoryTrend(history, anchorKey) {
  if (!Array.isArray(history?.monthly_data)) return null;
  const rows = history.monthly_data.filter((row) => row.category_breakdown !== undefined && row.category_breakdown !== null);
  if (rows.length === 0 && history.monthly_data.length > 0) return null;
  const byKey = new Map(rows.map((row) => [invoiceKey(row.year, row.month), row]));
  const categories = [];
  const months = Array.from({ length: 6 }, (_, index) => {
    const key = offsetMonth(anchorKey, index - 5);
    const row = byKey.get(key);
    const values = {};
    if (row) {
      Object.entries(row.category_breakdown).forEach(([category, raw]) => {
        const amount = numberOrNull(raw);
        if (amount === null) return;
        values[category] = amount;
        if (!categories.includes(category)) categories.push(category);
      });
    }
    return { key, month: parseInvoiceKey(key)?.month, available: Boolean(row), values };
  });
  const firstInvoice = months.findIndex((month) => month.available);
  return { months: firstInvoice < 0 ? [] : months.slice(firstInvoice), categories };
}
