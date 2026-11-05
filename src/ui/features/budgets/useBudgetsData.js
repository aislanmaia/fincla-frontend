import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBudgetCreateChoices,
  createBudgetForUi,
  formatBudgetsApiError,
  listBudgetCategoryChoicesForUi,
  listBudgetHistoryForUi,
  listBudgetsForUi,
  mapBudgetHistoryToUi,
  mapBudgetsResponseToUi,
  updateBudgetForUi,
} from "../../data/budgetsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  /** Relendo depois de uma transação, com os números anteriores ainda na tela. */
  isRefreshing: false,
  isSaving: false,
  error: "",
  data: null,
  choices: [],
  history: [],
};

export function useBudgetsData({
  organizationId,
  enabled = true,
  /** Sobe a cada transação criada/editada/excluída no app (#272): o gasto e o
      restante de cada orçamento mudam com ela, e sem isto a tela seguia com os
      números antigos até o F5. */
  refreshKey = 0,
}) {
  const [state, setState] = useState(EMPTY_STATE);
  // Organização da última leitura BEM-SUCEDIDA. Mesma org = recarga de algo já na
  // tela: os números ficam lá até os novos chegarem (sem piscar "carregando"), e uma
  // falha não apaga o que se sabia. Outra org = leitura nova, do zero.
  const loadedOrgRef = useRef(null);

  useEffect(() => {
    if (!enabled || !organizationId) {
      loadedOrgRef.current = null;
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    const isRefresh = loadedOrgRef.current === organizationId;
    setState((current) => (isRefresh
      ? { ...current, isRefreshing: true, error: "" }
      : { ...EMPTY_STATE, isLoading: true }));

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
        loadedOrgRef.current = organizationId;
      })
      .catch((error) => {
        if (cancelled) return;
        if (isRefresh) {
          // Os números anteriores continuam na tela; o erro aparece por cima deles.
          setState((current) => ({ ...current, isRefreshing: false, error: formatBudgetsApiError(error) }));
          return;
        }
        setState({
          ...EMPTY_STATE,
          error: formatBudgetsApiError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, refreshKey]);

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

  const updateBudget = useCallback(async (budgetId, body) => {
    if (!organizationId) return null;

    setState((current) => ({
      ...current,
      isSaving: true,
      error: "",
    }));

    try {
      await updateBudgetForUi(organizationId, budgetId, body);
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
    updateBudget,
  }), [createBudget, updateBudget, state]);
}
