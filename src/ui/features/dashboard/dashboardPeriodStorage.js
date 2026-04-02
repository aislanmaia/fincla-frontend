/**
 * Persistência local do intervalo da Visão Geral (localStorage).
 * Por organização; sobrevive a refresh, navegação e novo login no mesmo navegador.
 * Futuro: espelhar em preferências no servidor quando existir endpoint.
 */

import {
  DASHBOARD_PERIOD_PRESETS,
  parseLocalYmd,
  rangeForDashboardPreset,
} from "./dashboardDateRange.js";

const STORAGE_KEY = "fincla.dashboard.period.v1";

const ALLOWED_PRESETS = new Set(DASHBOARD_PERIOD_PRESETS.map((p) => p.id));

/**
 * @typedef {{ presetId: string; customStart: string; customEnd: string }} DashboardPeriodStored
 */

/**
 * @param {unknown} raw
 * @returns {DashboardPeriodStored | null}
 */
function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const presetId = raw.presetId;
  const customStart = raw.customStart;
  const customEnd = raw.customEnd;
  if (typeof presetId !== "string" || !ALLOWED_PRESETS.has(presetId)) return null;
  if (typeof customStart !== "string" || typeof customEnd !== "string") return null;
  if (!parseLocalYmd(customStart) || !parseLocalYmd(customEnd)) return null;
  if (customStart > customEnd) return null;
  return { presetId, customStart, customEnd };
}

/**
 * @param {string} organizationId
 * @returns {DashboardPeriodStored | null}
 */
export function readDashboardPeriodFromStorage(organizationId) {
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
 * Estado inicial do período na Visão Geral (primeira pintura + troca de organização).
 * Deve ser usado no useState inicial para não gravar "este mês" no localStorage antes da hidratação.
 *
 * @param {string | null | undefined} organizationId
 * @returns {{ periodPreset: string; customStart: string; customEnd: string }}
 */
export function getDashboardPeriodBootstrap(organizationId) {
  const now = new Date();
  if (!organizationId) {
    const r = rangeForDashboardPreset("este_mes", now);
    return { periodPreset: "este_mes", customStart: r.start, customEnd: r.end };
  }
  const stored = readDashboardPeriodFromStorage(organizationId);
  if (stored) {
    return {
      periodPreset: stored.presetId,
      customStart: stored.customStart,
      customEnd: stored.customEnd,
    };
  }
  const r = rangeForDashboardPreset("este_mes", now);
  return { periodPreset: "este_mes", customStart: r.start, customEnd: r.end };
}

/**
 * @param {string} organizationId
 * @param {DashboardPeriodStored} payload
 */
export function writeDashboardPeriodToStorage(organizationId, payload) {
  if (!organizationId || typeof localStorage === "undefined") return;
  const row = normalizeRow(payload);
  if (!row) return;
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const next = {
      version: 1,
      orgs: { ...(prev && typeof prev.orgs === "object" ? prev.orgs : {}), [organizationId]: row },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
