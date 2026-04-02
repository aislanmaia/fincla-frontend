import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildBudgetCreateChoices,
  createBudgetForUi,
  formatBudgetsApiError,
  listBudgetCategoryChoicesForUi,
  listBudgetHistoryForUi,
  listBudgetsForUi,
  mapBudgetHistoryToUi,
  mapBudgetsResponseToUi,
} from "../../data/budgetsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  isSaving: false,
  error: "",
  data: null,
  choices: [],
  history: [],
};

export function useBudgetsData({
  organizationId,
  enabled = true,
}) {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    setState({
      ...EMPTY_STATE,
      isLoading: true,
    });

    Promise.all([
      listBudgetsForUi(organizationId),
      listBudgetCategoryChoicesForUi(organizationId),
      listBudgetHistoryForUi(organizationId),
    ])
      .then(([budgetsResponse, tags, historyResponse]) => {
        if (cancelled) return;
        const mapped = mapBudgetsResponseToUi(budgetsResponse);
        setState({
          isLoading: false,
          isSaving: false,
          error: "",
          data: mapped,
          choices: buildBudgetCreateChoices(tags, budgetsResponse.budgets),
          history: mapBudgetHistoryToUi(historyResponse.months),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          error: formatBudgetsApiError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  const createBudget = useCallback(async (payload) => {
    if (!organizationId) return null;

    setState((current) => ({
      ...current,
      isSaving: true,
      error: "",
    }));

    try {
      await createBudgetForUi(organizationId, payload);
      const [budgetsResponse, tags, historyResponse] = await Promise.all([
        listBudgetsForUi(organizationId),
        listBudgetCategoryChoicesForUi(organizationId),
        listBudgetHistoryForUi(organizationId),
      ]);
      setState({
        isLoading: false,
        isSaving: false,
        error: "",
        data: mapBudgetsResponseToUi(budgetsResponse),
        choices: buildBudgetCreateChoices(tags, budgetsResponse.budgets),
        history: mapBudgetHistoryToUi(historyResponse.months),
      });
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: formatBudgetsApiError(error),
      }));
      throw error;
    }
  }, [organizationId]);

  return useMemo(() => ({
    ...state,
    hasRealData: Boolean(state.data),
    createBudget,
  }), [createBudget, state]);
}
