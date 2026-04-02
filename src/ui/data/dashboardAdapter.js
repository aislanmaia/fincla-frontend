import { getByCategory } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import { listRecurringTransactions } from "../../api/recurringTransactions";
import {
  getTransactionsSummary,
  listTransactions,
} from "../../api/transactions";
import { fetchAllTransactionsPages } from "./transactionsAdapter.js";

export {
  fetchAllTransactionsPages,
  getByCategory,
  getTransactionsSummary,
  listRecurringTransactions,
  listTransactions,
};

export function formatDashboardApiError(error) {
  return handleApiError(error);
}
