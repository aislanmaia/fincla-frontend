// The API sends calendar dates as "YYYY-MM-DD" and instants as UTC without an
// offset ("2026-11-22T22:33:00"). `new Date()` reads the second form as LOCAL
// time, which put every evening event on the next day (#340). Calendar dates are
// shown as written; instants are read as UTC and shown in Brasília time.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

export function parseAdminDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  if (DATE_ONLY.test(text)) return new Date(`${text}T12:00:00Z`);
  // FastAPI sends microseconds; JS only promises to parse milliseconds (Safari).
  const trimmed = text.replace(/(\.\d{3})\d+/, "$1");
  return new Date(HAS_OFFSET.test(trimmed) ? trimmed : `${trimmed}Z`);
}

export function formatAdminDate(value, options = {}) {
  const parsed = parseAdminDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...options }).format(parsed);
}

// Billing periods are calendar days stored as midnight without an offset
// ("2026-12-06T00:00:00"); read as an instant they would land on the previous
// day in Brasília. Show the day as written.
export function formatAdminDay(value) {
  if (!value) return "—";
  const day = String(value).slice(0, 10);
  return DATE_ONLY.test(day) ? day.split("-").reverse().join("/") : "—";
}
