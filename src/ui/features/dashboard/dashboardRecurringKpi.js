/**
 * KPIs de recorrência no dashboard alinhados ao contrato GET /transactions/summary
 * (`recurring_in_period`) com fallback ao resumo mensal de GET /recurring-series.
 */

/**
 * `null` quando NENHUMA das duas fontes tem um total — e nunca zero.
 *
 * O `|| 0` que estava no fim transformava "não existe total" em "zero por mês".
 * Ambas as fontes mandam `null` de propósito quando a organização tem mais de uma
 * moeda: não há um número que represente as duas, e a quebra é a resposta. Quem
 * chama decide como mostrar a ausência — no painel, um travessão.
 */
/** @param {object | null} transactionsSummary */
/** @param {{ total_monthly_expense?: number | null } | null} recurringListSummary */
export function pickCommittedExpenseForDashboard(transactionsSummary, recurringListSummary) {
  const rip = transactionsSummary?.recurring_in_period;
  if (rip != null && typeof rip.total_expense === "number") {
    return Math.max(0, rip.total_expense);
  }
  const mensal = recurringListSummary?.total_monthly_expense;
  return typeof mensal === "number" && Number.isFinite(mensal) ? Math.max(0, mensal) : null;
}

/** @param {object | null} transactionsSummary */
/** @param {{ total_monthly_income?: number | null } | null} recurringListSummary */
export function pickProjectedRecurringIncomeForDashboard(transactionsSummary, recurringListSummary) {
  const rip = transactionsSummary?.recurring_in_period;
  if (rip != null && typeof rip.total_income === "number") {
    return Math.max(0, rip.total_income);
  }
  const mensal = recurringListSummary?.total_monthly_income;
  return typeof mensal === "number" && Number.isFinite(mensal) ? Math.max(0, mensal) : null;
}
