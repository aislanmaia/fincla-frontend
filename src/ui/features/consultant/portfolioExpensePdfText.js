// Pure text helpers for the portfolio expense PDF. Kept out of the react-pdf component so they are testable
// and so the PDF never prints characters the built-in Helvetica cannot draw (e.g. arrows).
import { fmtMoneyIn } from "./consultantFormat";

// What the report counts as spending, stated once for the screen and the PDF.
export const EXPENSE_BASIS_NOTE = "Inclui despesas ainda não pagas mas já lançadas";

export function pdfDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export const pdfDateRange = (start, end) => `${pdfDate(start)} a ${pdfDate(end)}`;

const endSentence = (text) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

export function pdfInsightLine(index, insight) {
  return `${index + 1}. ${endSentence(insight.title)} ${endSentence(insight.description)} Próxima investigação: ${insight.follow_up}`;
}

export function pdfCohortLine(cohort) {
  return `${cohort.client_count} clientes · ${cohort.base_currency} para ${cohort.reading_currency}: ${fmtMoneyIn(cohort.original_total.amount, cohort.base_currency)} convertidos em ${fmtMoneyIn(cohort.converted_total.amount, cohort.reading_currency)}`;
}
