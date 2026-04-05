/**
 * Re-export do adapter de séries recorrentes (`/v1/recurring-series`).
 * Nome do arquivo mantido para imports legados.
 */
export * from "./recurringSeriesAdapter.js";

import { listRecurringSeriesForUi } from "./recurringSeriesAdapter.js";

/** Compat: resposta usa `series` + `summary` (não `recurring_transactions`). */
export async function listRecurringTransactionsForUi(organizationId, isActive, period) {
  return listRecurringSeriesForUi(organizationId, isActive, period);
}
