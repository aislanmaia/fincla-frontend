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

// fincla-frontend#109 achado 2 — `EMPTY_STATE.isLoading` é `false`; sem isto,
// o 1º quadro (antes do `useEffect` abaixo rodar) lia `isLoading:false,
// hasLoaded:false, transactions:[]` e a página confundia "a busca nem
// começou" com "vazio de verdade" (issue #106 reaberta pelo mesmo motivo que
// motivou a correção do catálogo de tags: `useState` estático não reflete o
// que o efeito está prestes a fazer).
function initialState(enabled, organizationId) {
  return { ...EMPTY_STATE, isLoading: Boolean(enabled && organizationId) };
}

export function useTransactionsData({
  organizationId,
  enabled = true,
  filters,
  refreshToken = 0,
}) {
  const [state, setState] = useState(() => initialState(enabled, organizationId));
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

    // fincla-frontend#109 rodada 2, achado 3: o scroll infinito (`hasMore`/
    // `tryLoadMore` em TransacoesPage.jsx) só aumenta `filters.limit` — a
    // MESMA pergunta, só mais páginas. Mas `filters` é um objeto NOVO a cada
    // bump (a página recalcula com `visible` maior), então `query`/
    // `summaryQuery` também viram referências novas e `sameFilters` acima dá
    // `false` — indistinguível, por comparação referencial, de uma troca de
    // verdade de organização/filtro. Sem isto, uma falha ao "carregar mais"
    // cairia no ramo "contexto novo" abaixo e trocaria as linhas JÁ LIDAS
    // pelo card de erro, derrubando os KPIs a zero. Comparar por CONTEÚDO,
    // ignorando `limit`/`page`, captura exatamente essa continuação.
    const { limit: _limit, page: _page, ...queryWithoutPagination } = query;
    const browsingContextKey = JSON.stringify({
      organizationId,
      queryWithoutPagination,
      summaryQuery,
    });
    const samePaginationContext =
      prev != null && prev.browsingContextKey === browsingContextKey;

    prevFetchSig.current = {
      organizationId,
      query,
      summaryQuery,
      refreshToken,
      browsingContextKey,
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

        const message = formatTransactionsApiError(error);
        setState((current) =>
          softRefreshOnly || samePaginationContext
            ? // Stale-while-revalidate de verdade (mesmo padrão do
              // `useCalendarData`): MESMA organização e MESMOS filtros — só o
              // `refreshToken` mudou (ex.: transação salva em outra tela) OU
              // só `limit` cresceu (scroll infinito, achado 3 da rodada 2) —
              // os dados na tela continuam válidos pra ESTE contexto, então
              // preserva (`...current`) e só o aviso de erro liga.
              { ...current, isLoading: false, error: message }
            : // Organização OU filtros de verdade mudaram (fincla-frontend#109
              // achado 3): `current` é de OUTRO contexto — preservar aqui
              // mostraria a lista/KPIs da organização ou do filtro ANTERIOR
              // sob os chips já trocados na tela, uma mentira silenciosa por
              // trás de um banner de erro. `hasLoaded` volta a `false`: este
              // contexto nunca carregou com sucesso.
              {
                isLoading: false,
                error: message,
                summary: null,
                transactions: [],
                total: 0,
                pagination: null,
                hasLoaded: false,
              },
        );
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
