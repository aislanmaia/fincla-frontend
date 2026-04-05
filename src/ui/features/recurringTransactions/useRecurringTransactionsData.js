import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatRecurringTransactionsApiError,
  listRecurringTransactionsForUi,
  mapRecurringSummaryToUi,
  mapRecurringTransactionToUi,
  toggleRecurringSeriesForUi,
  deleteRecurringSeriesForUi,
} from "../../data/recurringTransactionsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  isTogglingId: null,
  isDeletingId: null,
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
  refreshKey = 0,
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
        const rows = response.series ?? [];
        setState({
          isLoading: false,
          isTogglingId: null,
          isDeletingId: null,
          error: "",
          list: rows.map(mapRecurringTransactionToUi),
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
  }, [enabled, organizationId, refreshKey]);

  const toggleRecurring = useCallback(async (seriesId, nextIsActive) => {
    if (!organizationId) return null;
    setState((current) => ({
      ...current,
      isTogglingId: seriesId,
      error: "",
    }));

    try {
      const updated = await toggleRecurringSeriesForUi(seriesId, organizationId, nextIsActive);
      const mapped = mapRecurringTransactionToUi(updated);
      setState((current) => {
        const nextList = current.list.map((row) => (row.id === seriesId ? mapped : row));
        const totalRec = nextList.filter((row) => row.ativa && row.tipo === "receita").reduce((sum, row) => sum + row.val, 0);
        const totalDesp = nextList.filter((row) => row.ativa && row.tipo === "despesa").reduce((sum, row) => sum + row.val, 0);
        return {
          ...current,
          isTogglingId: null,
          list: nextList,
          summary: {
            totalRec,
            totalDesp,
            saldoFixo: totalRec - totalDesp,
            activeCount: nextList.filter((row) => row.ativa).length,
            pausedCount: nextList.filter((row) => !row.ativa).length,
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

  const deleteRecurring = useCallback(async (seriesId) => {
    if (!organizationId) return;
    setState((current) => ({
      ...current,
      isDeletingId: seriesId,
      error: "",
    }));
    try {
      await deleteRecurringSeriesForUi(seriesId, organizationId);
      setState((current) => {
        const nextList = current.list.filter((row) => row.id !== seriesId);
        const totalRec = nextList.filter((row) => row.ativa && row.tipo === "receita").reduce((sum, row) => sum + row.val, 0);
        const totalDesp = nextList.filter((row) => row.ativa && row.tipo === "despesa").reduce((sum, row) => sum + row.val, 0);
        return {
          ...current,
          isDeletingId: null,
          list: nextList,
          summary: {
            totalRec,
            totalDesp,
            saldoFixo: totalRec - totalDesp,
            activeCount: nextList.filter((row) => row.ativa).length,
            pausedCount: nextList.filter((row) => !row.ativa).length,
          },
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        isDeletingId: null,
        error: formatRecurringTransactionsApiError(error),
      }));
      throw error;
    }
  }, [organizationId]);

  return useMemo(() => ({
    ...state,
    toggleRecurring,
    deleteRecurring,
    hasRealData: state.list.length > 0,
  }), [state, toggleRecurring, deleteRecurring]);
}
