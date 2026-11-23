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
  return new Date(HAS_OFFSET.test(text) ? text : `${text}Z`);
}

export function formatAdminDate(value, options = {}) {
  const parsed = parseAdminDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...options }).format(parsed);
}
