import { getByCategory } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import { listRecurringSeries } from "../../api/recurringSeries";
import {
  getTransactionsSummary,
  listTransactions,
} from "../../api/transactions";
import { fetchAllTransactionsPages } from "./transactionsAdapter.js";

export {
  fetchAllTransactionsPages,
  getByCategory,
  getTransactionsSummary,
  listRecurringSeries as listRecurringTransactions,
  listTransactions,
};

export function formatDashboardApiError(error) {
  return handleApiError(error);
}
