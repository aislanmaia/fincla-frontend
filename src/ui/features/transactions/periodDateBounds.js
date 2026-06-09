/** Limites de data aceitos nos filtros de transações (alinhado ao LocaleDatePicker). */
export const TRANSACTIONS_DATE_MIN = "2000-01-01";
export const TRANSACTIONS_DATE_MAX = "2100-12-31";

/** @param {string} ymd */
export function parseLocalYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** @param {Date} dt */
export function ymdFromDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Se ambas existem e from > to, inverte. */
export function normalizeOpenRange(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return { from: fromYmd || "", to: toYmd || "" };
  const a = parseLocalYmd(fromYmd);
  const b = parseLocalYmd(toYmd);
  if (!a || !b) return { from: fromYmd, to: toYmd };
  if (a.getTime() <= b.getTime()) return { from: fromYmd, to: toYmd };
  return { from: toYmd, to: fromYmd };
}
