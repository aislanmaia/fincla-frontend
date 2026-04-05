/**
 * KPIs de recorrência no dashboard alinhados ao contrato GET /transactions/summary
 * (`recurring_in_period`) com fallback ao resumo mensal de GET /recurring-series.
 */

/** @param {object | null} transactionsSummary */
/** @param {{ total_monthly_expense?: number } | null} recurringListSummary */
export function pickCommittedExpenseForDashboard(transactionsSummary, recurringListSummary) {
  const rip = transactionsSummary?.recurring_in_period;
  if (rip != null && typeof rip.total_expense === "number") {
    return Math.max(0, rip.total_expense);
  }
  return Math.max(0, Number(recurringListSummary?.total_monthly_expense) || 0);
}

/** @param {object | null} transactionsSummary */
/** @param {{ total_monthly_income?: number } | null} recurringListSummary */
export function pickProjectedRecurringIncomeForDashboard(transactionsSummary, recurringListSummary) {
  const rip = transactionsSummary?.recurring_in_period;
  if (rip != null && typeof rip.total_income === "number") {
    return Math.max(0, rip.total_income);
  }
  return Math.max(0, Number(recurringListSummary?.total_monthly_income) || 0);
}
