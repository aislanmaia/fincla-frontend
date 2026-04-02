import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGoalForUi,
  formatGoalsApiError,
  listGoalsForUi,
  mapGoalToUi,
  updateGoalForUi,
} from "../../data/goalsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  isSaving: false,
  error: "",
  goals: [],
  hasLoaded: false,
};

export function useGoalsData({
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

    listGoalsForUi(organizationId)
      .then((goals) => {
        if (cancelled) return;
        setState({
          isLoading: false,
          isSaving: false,
          error: "",
          goals: goals.map((goal, index) => mapGoalToUi(goal, index)),
          hasLoaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          error: formatGoalsApiError(error),
          hasLoaded: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  const createGoal = useCallback(async (payload) => {
    setState((current) => ({
      ...current,
      isSaving: true,
      error: "",
    }));

    try {
      const created = await createGoalForUi(payload);
      setState((current) => ({
        ...current,
        isSaving: false,
        goals: [...current.goals, mapGoalToUi(created, current.goals.length)],
        hasLoaded: true,
      }));
      return created;
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: formatGoalsApiError(error),
      }));
      throw error;
    }
  }, []);

  const updateGoal = useCallback(async (goalId, payload) => {
    if (!organizationId) return null;

    setState((current) => ({
      ...current,
      isSaving: true,
      error: "",
    }));

    try {
      const updated = await updateGoalForUi(goalId, organizationId, payload);
      setState((current) => ({
        ...current,
        isSaving: false,
        goals: current.goals.map((goal, index) => (
          goal.id === goalId ? mapGoalToUi(updated, index) : goal
        )),
      }));
      return updated;
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        error: formatGoalsApiError(error),
      }));
      throw error;
    }
  }, [organizationId]);

  return useMemo(() => ({
    ...state,
    createGoal,
    updateGoal,
    hasRealData: state.hasLoaded,
  }), [createGoal, state, updateGoal]);
}
