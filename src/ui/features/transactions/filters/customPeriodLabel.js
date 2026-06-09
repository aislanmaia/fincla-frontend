const LOCALE = "pt-BR";

/** @param {string} ymd */
function parseLocalYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function stripPtLocale(s) {
  return s.replace(/\./g, "").replace(/\sde\s/g, " ");
}

function formatDayMonth(d, locale = LOCALE) {
  return stripPtLocale(
    d.toLocaleDateString(locale, { day: "numeric", month: "short" }),
  );
}

function formatDayMonthYear(d, locale = LOCALE) {
  return stripPtLocale(
    d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
  );
}

/**
 * Label amigável para período personalizado (facet pill, badges).
 *
 * @param {string} customFrom YYYY-MM-DD
 * @param {string} customTo YYYY-MM-DD
 * @param {string} [locale]
 */
export function formatCustomPeriodLabel(customFrom, customTo, locale = LOCALE) {
  const from = parseLocalYmd(customFrom);
  const to = parseLocalYmd(customTo);

  if (from && to) {
    const sameMonth =
      from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
    const sameYear = from.getFullYear() === to.getFullYear();

    if (sameMonth) {
      const month = stripPtLocale(
        from.toLocaleDateString(locale, { month: "short" }),
      );
      return `${from.getDate()}–${to.getDate()} ${month}`;
    }

    const start = formatDayMonth(from, locale);
    const end = formatDayMonth(to, locale);
    if (sameYear) return `${start} – ${end}`;
    return `${formatDayMonthYear(from, locale)} – ${formatDayMonthYear(to, locale)}`;
  }

  if (from) return `A partir de ${formatDayMonth(from, locale)}`;
  if (to) return `Até ${formatDayMonth(to, locale)}`;
  return "Personalizado";
}
