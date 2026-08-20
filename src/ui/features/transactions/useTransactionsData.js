import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTransactionsSummaryQuery,
  buildTransactionsQuery,
  deleteTransactionForUi,
  formatTransactionsApiError,
  getTransactionsSummaryForUi,
  listTransactionsForUi,
  mapApiTransactionToUi,
  setTransactionSettledForUi,
} from "../../data/transactionsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  summary: null,
  transactions: [],
  total: 0,
  pagination: null,
  // Só vira `true` num `.then` (sucesso) — mesmo padrão do `useCalendarData`
  // (issue #106). Enquanto for `false`, uma lista vazia é uma LACUNA de
  // informação (a busca não terminou ou falhou), não o fato "sem transações".
  hasLoaded: false,
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
          hasLoaded: true,
        });
      })
      .catch((error) => {
        if (cancelled) return;

        // Stale-while-revalidate (mesmo padrão do `useCalendarData`): NÃO apaga
        // os dados já carregados. Se esta é a 1ª carga, `transactions` já está
        // vazio (nada a preservar); se é uma revalidação (troca de filtro ou
        // `refreshToken`), a lista anterior continua válida na tela — só o
        // aviso de erro liga. `hasLoaded` não é tocado aqui: só o `.then`
        // acima pode ligá-lo, senão "nunca carregou com sucesso" morre depois
        // da primeira falha e o "vazio confiante" (issue #106) volta por trás
        // de um retry.
        setState((current) => ({
          ...current,
          isLoading: false,
          error: formatTransactionsApiError(error),
        }));
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

  /**
   * Liquida ou desfaz a liquidação, substituindo a linha em memória pela que o backend
   * devolveu. Sem refetch de propósito: a lista não pisca e o usuário vê o badge sumir
   * no mesmo frame. Se o servidor recusar, nada muda na tela — só o erro aparece.
   */
  const setTransactionSettled = useCallback(async (transactionId, settled) => {
    if (!organizationId) return;

    try {
      const updated = await setTransactionSettledForUi(transactionId, organizationId, settled);
      setState((current) => ({
        ...current,
        transactions: current.transactions.map((item) =>
          item.id === transactionId ? { ...item, ...updated } : item,
        ),
      }));
      return updated;
    } catch (error) {
      const message = formatTransactionsApiError(error);
      setState((current) => ({ ...current, error: message }));
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
    hasLoaded: state.hasLoaded,
    summary: state.summary,
    transactions: state.transactions,
    total: state.total,
    hasMore,
    removeTransaction,
    setTransactionSettled,
  };
}
