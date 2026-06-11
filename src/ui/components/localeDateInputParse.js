/**
 * Interpreta digitação de datas (pt-BR): dd/mm/aaaa.
 * Durante a digitação exige ano com 4 dígitos; no commit (blur/Enter) aceita dd/mm/aa → 20aa.
 */

/** Placeholder visual da máscara pt-BR (dia/mês/ano). */
export const BR_DATE_INPUT_MASK_PLACEHOLDER = "dd/mm/aaaa";

/**
 * Aplica máscara ##/##/#### enquanto o usuário digita (até 8 dígitos).
 * @param {string} raw
 */
export function maskBrDateInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseYmdStrict(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ymdFromParts(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function startOfLocalDay(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

/**
 * @typedef {'empty' | 'incomplete' | 'ok' | 'invalid_date' | 'out_of_range' | 'invalid_format'} BrDateParseStatus
 */

/**
 * Classifica o texto digitado (feedback na UI).
 * @param {string} raw
 * @param {string} minYmd
 * @param {string} maxYmd
 * @returns {{ status: 'ok'; ymd: string } | { status: Exclude<BrDateParseStatus, 'ok'>; ymd?: undefined }}
 */
export function parseBrDateLooseResult(raw, minYmd, maxYmd) {
  const minD = parseYmdStrict(minYmd);
  const maxD = parseYmdStrict(maxYmd);

  /**
   * @returns {{ kind: 'ok'; ymd: string } | { kind: 'invalid_calendar' } | { kind: 'out_of_range' }}
   */
  const clampAttempt = (yyyy, mm, dd) => {
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
      return { kind: "invalid_calendar" };
    }
    const ymd = ymdFromParts(yyyy, mm, dd);
    const t0 = startOfLocalDay(dt);
    if (minD && t0 < startOfLocalDay(minD)) return { kind: "out_of_range" };
    if (maxD && t0 > startOfLocalDay(maxD)) return { kind: "out_of_range" };
    return { kind: "ok", ymd };
  };

  const mapClamp = (c) => {
    if (c.kind === "ok") return { status: /** @type {const} */ ("ok"), ymd: c.ymd };
    if (c.kind === "out_of_range") return { status: /** @type {const} */ ("out_of_range") };
    return { status: /** @type {const} */ ("invalid_date") };
  };

  const s = String(raw ?? "").trim();
  if (!s) return { status: "empty" };

  const digits = s.replace(/\D/g, "");

  if (digits.length === 8) {
    const dd = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    const yyyy = parseInt(digits.slice(4, 8), 10);
    return mapClamp(clampAttempt(yyyy, mm, dd));
  }

  const slashFull = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (slashFull) {
    const dd = parseInt(slashFull[1], 10);
    const mm = parseInt(slashFull[2], 10);
    const yyyy = parseInt(slashFull[3], 10);
    return mapClamp(clampAttempt(yyyy, mm, dd));
  }

  const slashPartialYear = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,3})$/);
  if (slashPartialYear) {
    return { status: "incomplete" };
  }

  if (digits.length > 0 && digits.length < 8) {
    return { status: "incomplete" };
  }

  if (s.length > 0) {
    return { status: "invalid_format" };
  }

  return { status: "empty" };
}

/**
 * Parse no commit (blur/Enter): expande dd/mm/aa ou 6 dígitos para ano completo.
 * @param {string} raw
 * @param {string} minYmd
 * @param {string} maxYmd
 * @returns {{ status: 'ok'; ymd: string } | { status: Exclude<BrDateParseStatus, 'ok'>; ymd?: undefined }}
 */
export function parseBrDateLooseOnCommit(raw, minYmd, maxYmd) {
  const res = parseBrDateLooseResult(raw, minYmd, maxYmd);
  if (res.status !== "incomplete") return res;

  const s = String(raw ?? "").trim();
  const slashShortYear = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2})$/);
  if (slashShortYear) {
    const dd = parseInt(slashShortYear[1], 10);
    const mm = parseInt(slashShortYear[2], 10);
    const yyyy = 2000 + parseInt(slashShortYear[3], 10);
    const expanded = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
    return parseBrDateLooseResult(expanded, minYmd, maxYmd);
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length === 6) {
    const dd = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    const yyyy = 2000 + parseInt(digits.slice(4, 6), 10);
    const expanded = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
    return parseBrDateLooseResult(expanded, minYmd, maxYmd);
  }

  return res;
}

/**
 * @param {string} raw texto do usuário
 * @param {string} minYmd 'yyyy-mm-dd'
 * @param {string} maxYmd 'yyyy-mm-dd'
 * @returns {string | null} ymd ou null
 */
export function tryParseBrDateLoose(raw, minYmd, maxYmd) {
  const r = parseBrDateLooseResult(raw, minYmd, maxYmd);
  return r.status === "ok" ? r.ymd : null;
}
