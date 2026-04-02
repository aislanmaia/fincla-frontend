/**
 * Interpreta digitação rápida de datas (pt-BR): dd/mm/aaaa, só dígitos 6 ou 8.
 * 8 dígitos: DDMMYYYY · 6 dígitos: DDMMYY → 20YY
 */

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

  if (digits.length === 6) {
    const dd = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    const yy = parseInt(digits.slice(4, 6), 10);
    const yyyy = 2000 + yy;
    return mapClamp(clampAttempt(yyyy, mm, dd));
  }

  const slash = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (slash) {
    const dd = parseInt(slash[1], 10);
    const mm = parseInt(slash[2], 10);
    let yyyy = parseInt(slash[3], 10);
    if (yyyy < 100) yyyy += 2000;
    return mapClamp(clampAttempt(yyyy, mm, dd));
  }

  if (digits.length > 0 && digits.length < 6) {
    return { status: "incomplete" };
  }

  if (digits.length === 7) {
    return { status: "invalid_format" };
  }

  if (s.length > 0) {
    return { status: "invalid_format" };
  }

  return { status: "empty" };
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
