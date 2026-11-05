import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  contributeToGoalForUi,
  createGoalForUi,
  formatGoalsApiError,
  getGoalForUi,
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
  // A organização viva agora: resposta atrasada de outra org não escreve aqui.
  const orgRef = useRef(organizationId);
  orgRef.current = organizationId;

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

  /**
   * Registra um aporte e relê a meta no servidor: o progresso (e o "No ritmo")
   * deriva das contribuições, então só a releitura é a verdade.
   *
   * Gravou mas a releitura falhou? O aporte EXISTE — tratar como falha levaria a
   * pessoa a repetir e contar o dinheiro duas vezes. Então resolve com sucesso e
   * deixa um aviso na página. Só a recusa do POST rejeita (com a mensagem pronta),
   * e ela não toca o `error` da página: o modal mostra o próprio erro.
   */
  const contribute = useCallback(async (goalId, payload) => {
    if (!organizationId) return null;
    const org = organizationId;

    setState((current) => ({ ...current, isSaving: true }));

    let contribution;
    try {
      contribution = await contributeToGoalForUi(goalId, org, payload);
    } catch (error) {
      if (orgRef.current === org) setState((current) => ({ ...current, isSaving: false }));
      throw new Error(formatGoalsApiError(error));
    }

    try {
      const fresh = await getGoalForUi(goalId, org);
      if (orgRef.current === org) {
        setState((current) => ({
          ...current,
          isSaving: false,
          goals: current.goals.map((goal, index) => (goal.id === goalId ? mapGoalToUi(fresh, index) : goal)),
        }));
      }
    } catch {
      if (orgRef.current === org) {
        setState((current) => ({
          ...current,
          isSaving: false,
          error: "Aporte registrado, mas não consegui atualizar a meta. Recarregue a página para ver o progresso.",
        }));
      }
    }
    return contribution;
  }, [organizationId]);

  return useMemo(() => ({
    ...state,
    createGoal,
    updateGoal,
    contribute,
    hasRealData: state.hasLoaded,
  }), [contribute, createGoal, state, updateGoal]);
}
