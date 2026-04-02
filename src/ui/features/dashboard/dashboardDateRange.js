/**
 * Intervalos do dashboard Visão Geral (presets + utilitários).
 * Datas em calendário local, strings YYYY-MM-DD.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @param {Date} d */
export function toIsoLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** @param {string} ymd */
export function parseLocalYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;
  return dt;
}

/** @param {Date} d */
export function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** @param {Date} d @param {number} n */
export function addLocalDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Inclusivo: ambos os extremos contam. */
export function daysInclusive(startDate, endDate) {
  const a = startOfLocalDay(startDate);
  const b = startOfLocalDay(endDate);
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Janela imediatamente anterior à selecionada, com o mesmo número de dias
 * (para comparação no card Gastos por Categoria).
 */
export function previousPeriodRange(dateStartYmd, dateEndYmd) {
  const s = parseLocalYmd(dateStartYmd);
  const e = parseLocalYmd(dateEndYmd);
  if (!s || !e) return { start: dateStartYmd, end: dateEndYmd };
  const len = daysInclusive(s, e);
  const prevEnd = addLocalDays(s, -1);
  const prevStart = addLocalDays(prevEnd, -(len - 1));
  return {
    start: toIsoLocalDate(prevStart),
    end: toIsoLocalDate(prevEnd),
  };
}

function sameCalendarMonth(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  );
}

/**
 * Frase curta para badges (ex.: "abr/26" ou "jan–mar/26").
 * @param {string} startYmd
 * @param {string} endYmd
 * @param {string} [locale]
 */
export function formatDashboardRangeBadge(startYmd, endYmd, locale = "pt-BR") {
  const s = parseLocalYmd(startYmd);
  const e = parseLocalYmd(endYmd);
  if (!s || !e) return "";
  if (sameCalendarMonth(s, e)) {
    return s
      .toLocaleDateString(locale, { month: "short", year: "2-digit" })
      .replace(/\./g, "");
  }
  const a = s
    .toLocaleDateString(locale, { month: "short", year: "2-digit" })
    .replace(/\./g, "");
  const b = e
    .toLocaleDateString(locale, { month: "short", year: "2-digit" })
    .replace(/\./g, "");
  return `${a.split(" ")[0]}–${b}`;
}

/**
 * Texto para KPIs: "março de 2026" ou intervalo legível.
 * @param {string} startYmd
 * @param {string} endYmd
 * @param {string} [locale]
 */
export function formatDashboardKpiPeriodPhrase(
  startYmd,
  endYmd,
  locale = "pt-BR",
) {
  const s = parseLocalYmd(startYmd);
  const e = parseLocalYmd(endYmd);
  if (!s || !e) return "";
  if (sameCalendarMonth(s, e)) {
    const t = s.toLocaleDateString(locale, { month: "long", year: "numeric" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const opt = { day: "numeric", month: "short", year: "numeric" };
  const a = s.toLocaleDateString(locale, opt).replace(/\./g, "");
  const b = e.toLocaleDateString(locale, opt).replace(/\./g, "");
  return `${a} – ${b}`;
}

/** Presets exibidos no seletor (id estável). */
export const DASHBOARD_PERIOD_PRESETS = [
  { id: "este_mes", label: "Este mês", short: "Mês atual" },
  { id: "mes_passado", label: "Mês passado", short: "Mês ant." },
  { id: "ultimos_30", label: "30 dias", short: "30 d" },
  { id: "tres_meses", label: "3 meses", short: "3 m" },
  { id: "seis_meses", label: "6 meses", short: "6 m" },
  { id: "doze_meses", label: "12 meses", short: "12 m" },
  { id: "ano_ytd", label: "Ano (YTD)", short: "YTD" },
  { id: "personalizado", label: "Período…", short: "…" },
];

/**
 * @param {string} presetId
 * @param {Date} [anchor]
 * @returns {{ start: string; end: string }}
 */
export function rangeForDashboardPreset(presetId, anchor = new Date()) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  const today = new Date(y, m, d);

  if (presetId === "este_mes") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "mes_passado") {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "ultimos_30") {
    const end = today;
    const start = addLocalDays(end, -29);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "tres_meses") {
    const end = new Date(y, m + 1, 0);
    const start = new Date(y, m - 2, 1);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "seis_meses") {
    const end = new Date(y, m + 1, 0);
    const start = new Date(y, m - 5, 1);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "doze_meses") {
    const end = new Date(y, m + 1, 0);
    const start = new Date(y, m - 11, 1);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
  }

  if (presetId === "ano_ytd") {
    const start = new Date(y, 0, 1);
    return { start: toIsoLocalDate(start), end: toIsoLocalDate(today) };
  }

  // personalizado: caller fornece datas; fallback seguro = este mês
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: toIsoLocalDate(start), end: toIsoLocalDate(end) };
}

/**
 * Normaliza intervalo personalizado (ordena e limita a datas válidas).
 * @param {string} a
 * @param {string} b
 */
export function normalizeCustomRange(a, b) {
  if (!parseLocalYmd(a) || !parseLocalYmd(b)) return null;
  let s = a <= b ? a : b;
  let e = a <= b ? b : a;
  return { start: s, end: e };
}
