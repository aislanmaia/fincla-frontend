import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatRecurringTransactionsApiError,
  listRecurringTransactionsForUi,
  mapRecurringSummaryToUi,
  mapRecurringTransactionToUi,
  toggleRecurringTransactionForUi,
} from "../../data/recurringTransactionsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  isTogglingId: null,
  error: "",
  list: [],
  summary: {
    totalRec: 0,
    totalDesp: 0,
    saldoFixo: 0,
    activeCount: 0,
    pausedCount: 0,
  },
};

export function useRecurringTransactionsData({
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

    listRecurringTransactionsForUi(organizationId)
      .then((response) => {
        if (cancelled) return;
        setState({
          isLoading: false,
          isTogglingId: null,
          error: "",
          list: (response.recurring_transactions || []).map(mapRecurringTransactionToUi),
          summary: mapRecurringSummaryToUi(response.summary),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          error: formatRecurringTransactionsApiError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  const toggleRecurring = useCallback(async (transactionId) => {
    if (!organizationId) return null;
    setState((current) => ({
      ...current,
      isTogglingId: transactionId,
      error: "",
    }));

    try {
      const updated = await toggleRecurringTransactionForUi(transactionId, organizationId);
      const mapped = mapRecurringTransactionToUi(updated);
      setState((current) => {
        const nextList = current.list.map((item) => item.id === transactionId ? mapped : item);
        const totalRec = nextList.filter((item) => item.ativa && item.tipo === "receita").reduce((sum, item) => sum + item.val, 0);
        const totalDesp = nextList.filter((item) => item.ativa && item.tipo === "despesa").reduce((sum, item) => sum + item.val, 0);
        return {
          ...current,
          isTogglingId: null,
          list: nextList,
          summary: {
            totalRec,
            totalDesp,
            saldoFixo: totalRec - totalDesp,
            activeCount: nextList.filter((item) => item.ativa).length,
            pausedCount: nextList.filter((item) => !item.ativa).length,
          },
        };
      });
      return mapped;
    } catch (error) {
      setState((current) => ({
        ...current,
        isTogglingId: null,
        error: formatRecurringTransactionsApiError(error),
      }));
      throw error;
    }
  }, [organizationId]);

  return useMemo(() => ({
    ...state,
    toggleRecurring,
    hasRealData: state.list.length > 0,
  }), [state, toggleRecurring]);
}
