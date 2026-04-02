import { useEffect, useState } from "react";
import { listBudgets } from "../../../api/budgets";
import { listGoals } from "../../../api/goals";
import { listTransactions } from "../../../api/transactions";
import { buildTransactionsQuery } from "../../data/transactionsAdapter.js";

const INITIAL = { completedTx: false, completedBudget: false };

/**
 * First-steps checklist completion from the API (live data mode).
 * Skips mock UI: only fetches when `enabled` (authenticated org + live dataMode).
 */
export function useFirstStepsLiveStatus({
  organizationId,
  enabled,
  refreshToken,
}) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(INITIAL);
      return;
    }

    let cancelled = false;
    const txQuery = buildTransactionsQuery({
      organizationId,
      period: "tudo",
      limit: 1,
      filterType: "todos",
      filterCat: "todas",
      filterMethod: "todos",
      sortBy: "date-desc",
    });

    Promise.all([
      listTransactions(txQuery),
      listBudgets(organizationId),
      listGoals(organizationId),
    ])
      .then(([txRes, budgetRes, goals]) => {
        if (cancelled) return;
        const total = txRes.pagination?.total ?? 0;
        const hasBudget =
          Array.isArray(budgetRes?.budgets) && budgetRes.budgets.length > 0;
        const hasGoals = Array.isArray(goals) && goals.length > 0;
        setState({
          completedTx: total > 0,
          completedBudget: hasBudget || hasGoals,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState(INITIAL);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, refreshToken]);

  return state;
}
