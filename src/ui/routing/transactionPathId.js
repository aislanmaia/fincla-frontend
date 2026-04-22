import { isUuidString } from "../data/transactionsAdapter.js";

/**
 * Identificador na URL `/transactions/:transactionId` (UUID API ou id numérico mock).
 */
export function isTransactionEditPathId(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 128) return false;
  if (isUuidString(s)) return true;
  return /^\d+$/.test(s);
}

/**
 * @param {string} pathname
 * @returns {string | null}
 */
export function transactionEditIdFromPathname(pathname) {
  const parts = String(pathname ?? "").split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "transactions") return null;
  return isTransactionEditPathId(parts[1]) ? parts[1] : null;
}
