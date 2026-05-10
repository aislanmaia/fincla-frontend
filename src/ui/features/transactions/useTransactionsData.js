import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTransactionsSummaryQuery,
  buildTransactionsQuery,
  deleteTransactionForUi,
  formatTransactionsApiError,
  getTransactionsSummaryForUi,
  listTransactionsForUi,
  mapApiTransactionToUi,
} from "../../data/transactionsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  summary: null,
  transactions: [],
  total: 0,
  pagination: null,
};

export function useTransactionsData({
  organizationId,
  enabled = true,
  filters,
  refreshToken = 0,
}) {
  const [state, setState] = useState(EMPTY_STATE);
  const prevFetchSig = useRef(null);

  const query = useMemo(() => {
    if (!organizationId) return null;
    return buildTransactionsQuery({
      organizationId,
      ...filters,
    });
  }, [organizationId, filters]);

  const summaryQuery = useMemo(() => {
    if (!organizationId) return null;
    return buildTransactionsSummaryQuery({
      organizationId,
      ...filters,
    });
  }, [organizationId, filters]);

  useEffect(() => {
    if (!enabled || !organizationId || !query || !summaryQuery) {
      setState(EMPTY_STATE);
      prevFetchSig.current = null;
      return;
    }

    const prev = prevFetchSig.current;
    const sameFilters =
      prev &&
      prev.organizationId === organizationId &&
      prev.query === query &&
      prev.summaryQuery === summaryQuery;
    const softRefreshOnly =
      sameFilters &&
      prev.refreshToken != null &&
      prev.refreshToken !== refreshToken;

    prevFetchSig.current = {
      organizationId,
      query,
      summaryQuery,
      refreshToken,
    };

    let cancelled = false;
    if (!softRefreshOnly) {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: "",
      }));
    } else {
      setState((current) => ({
        ...current,
        error: "",
      }));
    }

    Promise.all([
      listTransactionsForUi(query),
      getTransactionsSummaryForUi(summaryQuery),
    ])
      .then(([response, summary]) => {
        if (cancelled) return;

        const transactions = (response.data ?? []).map(mapApiTransactionToUi);
        setState({
          isLoading: false,
          error: "",
          summary,
          transactions,
          total: response.pagination?.total ?? transactions.length,
          pagination: response.pagination ?? null,
        });
      })
      .catch((error) => {
        if (cancelled) return;

        setState({
          isLoading: false,
          error: formatTransactionsApiError(error),
          summary: null,
          transactions: [],
          total: 0,
          pagination: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, query, summaryQuery, refreshToken]);

  const removeTransaction = useCallback(async (transactionId) => {
    if (!organizationId) return;

    try {
      await deleteTransactionForUi(transactionId, organizationId);
      setState((current) => ({
        ...current,
        transactions: current.transactions.filter((item) => item.id !== transactionId),
        total: Math.max(0, current.total - 1),
      }));
    } catch (error) {
      const message = formatTransactionsApiError(error);
      setState((current) => ({
        ...current,
        error: message,
      }));
      throw new Error(message);
    }
  }, [organizationId]);

  const hasMore = useMemo(() => {
    if (!query || state.error) return false;

    const loaded = state.transactions.length;
    const limit = Math.max(1, Number(query.limit) || 10);
    const next = state.pagination?.has_next;

    if (!state.isLoading && loaded < limit) return false;
    if (next === false) return false;
    if (next === true) return true;

    return state.total > loaded;
  }, [
    query,
    state.error,
    state.isLoading,
    state.pagination,
    state.total,
    state.transactions.length,
  ]);

  return {
    isLoading: state.isLoading,
    error: state.error,
    summary: state.summary,
    transactions: state.transactions,
    total: state.total,
    hasMore,
    removeTransaction,
  };
}
