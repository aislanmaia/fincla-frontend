import { monthNameLower, parseInvoiceKey } from "../cardHub/hubInvoices.js";

export function dayMonth(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ""));
  return m ? `${m[3]}/${m[2]}` : null;
}

export function localYmd(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "vence em 15 dias (10/11)" a partir do que o servidor calculou (`days_until_due`). */
export function dueText({ days, dueDate }) {
  const label = dayMonth(dueDate);
  if (days === null || days === undefined || !label) return label ? `vence em ${label}` : null;
  if (days === 0) return `vence hoje (${label})`;
  if (days > 0) return `vence em ${plural(days, "dia", "dias")} (${label})`;
  return `venceu há ${plural(Math.abs(days), "dia", "dias")} (${label})`;
}

export function previousMonthName(key) {
  const { month } = parseInvoiceKey(key) ?? {};
  return month ? monthNameLower(month === 1 ? 12 : month - 1) : null;
}
