/**
 * Textos e rótulos compartilhados entre calendários (LocaleDatePicker, PeriodCalendar, MiniCalendar).
 * Uma única fonte para nomes de mês e dias da semana alinhados ao locale.
 */

/** Cabeçalhos de coluna: domingo → sábado (alinhado a `Date.getDay()`). Ex.: pt-BR → dom., seg., ter. */
export function weekdayLabelsShort(locale) {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const anchor = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      return fmt.format(d);
    });
  } catch {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }
}

/** Título do mês no cabeçalho do grid: "Março de 2026" / "March 2026" com primeira letra maiúscula. */
export function formatCalendarNavMonth(year, monthIndex, locale = "pt-BR") {
  try {
    const raw = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(new Date(year, monthIndex, 1));
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }
}

/** @deprecated use formatCalendarNavMonth — mantido para imports antigos */
export const formatMonthYearTitle = formatCalendarNavMonth;
