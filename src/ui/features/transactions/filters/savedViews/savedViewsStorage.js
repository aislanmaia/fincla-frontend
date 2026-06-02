/**
 * Persistência local das Saved Views por organização.
 * Mesmo padrão de `transactionsPeriodStorage.js`.
 */

import { isValidView, normalizeView } from "./savedViewsModel.js";

const STORAGE_KEY = "fincla.transactions.savedViews.v1";

function safeReadAll() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return null;
    if (!parsed.orgs || typeof parsed.orgs !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSavedViews(organizationId) {
  if (!organizationId) return [];
  const all = safeReadAll();
  if (!all) return [];
  const list = all.orgs[organizationId];
  if (!Array.isArray(list)) return [];
  return list.map(normalizeView).filter(Boolean);
}

export function writeSavedViews(organizationId, list) {
  if (!organizationId || typeof localStorage === "undefined") return;
  const normalized = (Array.isArray(list) ? list : [])
    .map(normalizeView)
    .filter(Boolean);
  try {
    const all = safeReadAll() || { version: 1, orgs: {} };
    all.version = 1;
    all.orgs = { ...all.orgs, [organizationId]: normalized };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}

export function clearSavedViews(organizationId) {
  writeSavedViews(organizationId, []);
}

// Re-export para testes localizados que prefiram um único entry point.
export { isValidView, normalizeView };
