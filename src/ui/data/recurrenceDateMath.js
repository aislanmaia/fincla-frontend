/**
 * Utilidades puras para o cadastro de recorrências:
 * - cálculo da N-ésima ocorrência (usado para "Após N repetições" → end_date)
 * - cálculo da próxima ocorrência a partir da âncora + regra
 *
 * Mantém paridade com `src/domain/entities/recurring_series.py` (compute_next_occurrence)
 * em fincla-api.
 */

/** Date (Y-M-D no horário local). */
function ymdToDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(year, monthIndex /* 0..11 */) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampedDay(year, monthIndex, day) {
  return Math.min(day, daysInMonth(year, monthIndex));
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function addMonthsClamped(d, n) {
  const total = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = clampedDay(year, month, d.getDate());
  return new Date(year, month, day);
}

/**
 * Calcula a 1ª ocorrência da série a partir de uma start_date + regra.
 * Espelha `compute_first_occurrence` em fincla-api (recurring_series.py).
 *
 * - monthly: avança para o próximo dia_do_mês válido a partir de start_date
 *   (mesmo mês se day_of_month ainda não passou, próximo mês caso contrário).
 *   Faz clamp para o último dia em meses curtos (jan 31 → fev 28).
 * - weekly/biweekly/yearly/custom: retorna start_date como âncora literal.
 */
export function computeFirstOccurrence(startDate, frequency, { dayOfMonth = null, dayOfWeek = null } = {}) {
  if (!(startDate instanceof Date)) return null;

  if (frequency === "monthly") {
    const dom = dayOfMonth ?? startDate.getDate();
    const candidate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      clampedDay(startDate.getFullYear(), startDate.getMonth(), dom),
    );
    const candidateDay = candidate.getDate();
    if (candidateDay < startDate.getDate()) return addMonthsClamped(candidate, 1);
    return candidate;
  }

  return new Date(startDate);
}

/**
 * Calcula a próxima ocorrência ESTRITAMENTE depois de `from` conforme a regra.
 * frequency: "monthly" | "weekly" | "biweekly" | "yearly" | "custom"
 * dayOfWeek: 0 (Dom) .. 6 (Sáb) — usado por weekly
 * dayOfMonth: 1..31 — usado por monthly
 * interval, intervalUnit: usados por custom
 */
export function computeNextOccurrence(from, frequency, { dayOfMonth = null, dayOfWeek = null, interval = 1, intervalUnit = null } = {}) {
  if (!(from instanceof Date)) return null;

  if (frequency === "monthly") {
    const dom = dayOfMonth ?? from.getDate();
    let year = from.getFullYear();
    let month = from.getMonth();
    let candidate = new Date(year, month, clampedDay(year, month, dom));
    if (candidate <= from) {
      month += 1;
      if (month > 11) { year += 1; month = 0; }
      candidate = new Date(year, month, clampedDay(year, month, dom));
    }
    return candidate;
  }

  if (frequency === "weekly") {
    const targetDow = dayOfWeek ?? from.getDay();
    const fromDow = from.getDay();
    const daysAhead = ((targetDow - fromDow - 1 + 7) % 7) + 1;
    return addDays(from, daysAhead);
  }

  if (frequency === "biweekly") {
    return addDays(from, 14);
  }

  if (frequency === "yearly") {
    const y = from.getFullYear() + 1;
    const m = from.getMonth();
    const d = clampedDay(y, m, from.getDate());
    return new Date(y, m, d);
  }

  if (frequency === "custom") {
    const step = Math.max(1, Number(interval) || 1);
    if (intervalUnit === "day") return addDays(from, step);
    if (intervalUnit === "week") return addDays(from, step * 7);
    if (intervalUnit === "month") return addMonthsClamped(from, step);
    return addDays(from, step);
  }

  return addDays(from, 30);
}

/**
 * A partir da 1ª ocorrência e da regra, retorna a N-ésima ocorrência (1-indexed).
 * Útil para converter "Após N repetições" em `end_date`.
 */
export function computeNthOccurrence(firstOccurrence, n, frequency, opts = {}) {
  if (!(firstOccurrence instanceof Date) || !Number.isFinite(n) || n < 1) return null;
  if (n === 1) return new Date(firstOccurrence);
  let cursor = firstOccurrence;
  for (let i = 1; i < n; i += 1) {
    const next = computeNextOccurrence(cursor, frequency, opts);
    if (!next) return null;
    cursor = next;
  }
  return cursor;
}

/**
 * Calcula a end_date (YYYY-MM-DD) correspondente à N-ésima ocorrência
 * a partir de uma start_date (YYYY-MM-DD) + regra.
 *
 * Retorna null se entradas inválidas.
 */
export function computeEndDateFromOccurrences({
  startDateYmd,
  frequency,
  n,
  dayOfMonth = null,
  dayOfWeek = null,
  interval = 1,
  intervalUnit = null,
} = {}) {
  const start = ymdToDate(startDateYmd);
  if (!start) return null;
  const occ = computeNthOccurrence(start, Number(n), frequency, {
    dayOfMonth,
    dayOfWeek,
    interval,
    intervalUnit,
  });
  return dateToYmd(occ);
}
