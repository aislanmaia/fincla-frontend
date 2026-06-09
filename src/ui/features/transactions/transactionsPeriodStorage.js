/**
 * Persistência local do filtro de período da página Transações (localStorage).
 * Por organização; alinhado ao padrão de `dashboardPeriodStorage.js`.
 */

const STORAGE_KEY = "fincla.transactions.period.v1";

/** Período inicial quando não há preferência gravada (Este mês). */
export const TRANSACTIONS_DEFAULT_PERIOD = "mes";

const ALLOWED = new Set([
  "tudo",
  "hoje",
  "semana",
  "mes",
  "mes-ant",
  "3m",
  "ano",
  "custom",
]);

/** @param {string} s */
function parseYmd(s) {
  if (!s || typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/**
 * @param {unknown} raw
 * @returns {{ period: string; customFrom: string; customTo: string } | null}
 */
function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const period = raw.period;
  const customFrom = typeof raw.customFrom === "string" ? raw.customFrom : "";
  const customTo = typeof raw.customTo === "string" ? raw.customTo : "";
  if (typeof period !== "string" || !ALLOWED.has(period)) return null;
  if (period === "custom") {
    const f = parseYmd(customFrom);
    const t = parseYmd(customTo);
    if (!f && !t) return null;
    if (f && t && f > t) return null;
    return {
      period,
      customFrom: f ? customFrom : "",
      customTo: t ? customTo : "",
    };
  }
  return { period, customFrom: "", customTo: "" };
}

/**
 * @param {string} organizationId
 */
export function readTransactionsPeriodFromStorage(organizationId) {
  if (!organizationId || typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return null;
    const orgs = parsed.orgs;
    if (!orgs || typeof orgs !== "object") return null;
    return normalizeRow(orgs[organizationId]);
  } catch {
    return null;
  }
}

/**
 * Estado inicial do período (primeira pintura + troca de organização).
 *
 * @param {string | null | undefined} organizationId
 * @returns {{ period: string; customFrom: string; customTo: string }}
 */
export function getTransactionsPeriodBootstrap(organizationId) {
  const fallback = {
    period: TRANSACTIONS_DEFAULT_PERIOD,
    customFrom: "",
    customTo: "",
  };
  if (!organizationId) return fallback;
  const stored = readTransactionsPeriodFromStorage(organizationId);
  if (stored) return stored;
  return fallback;
}

/**
 * @param {string} organizationId
 * @param {{ period: string; customFrom: string; customTo: string }} payload
 */
export function writeTransactionsPeriodToStorage(organizationId, payload) {
  if (!organizationId || typeof localStorage === "undefined") return;
  const toWrite = {
    period: payload.period,
    customFrom: payload.period === "custom" ? payload.customFrom : "",
    customTo: payload.period === "custom" ? payload.customTo : "",
  };
  const row = normalizeRow(toWrite);
  if (!row) return;
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const next = {
      version: 1,
      orgs: {
        ...(prev && typeof prev.orgs === "object" ? prev.orgs : {}),
        [organizationId]: row,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
