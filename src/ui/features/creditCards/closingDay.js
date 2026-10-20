/** Mesma sugestão do backend (`suggested_closing_day`): 7 dias antes do vencimento, no máximo dia 28. */
export function suggestedClosingDay(dueDay) {
  const due = Number(dueDay);
  if (!Number.isInteger(due) || due < 1 || due > 31) return null;
  let closing = due - 7;
  if (closing <= 0) closing += 31;
  return Math.min(closing, 28);
}

/** Dia de mês válido (1 a 31) digitado como texto. */
export const isValidMonthDay = (value) => /^\d{1,2}$/.test(String(value ?? "").trim()) && Number(value) >= 1 && Number(value) <= 31;
