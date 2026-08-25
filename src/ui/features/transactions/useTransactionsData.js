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
  /* Carregando MAIS uma página da mesma pergunta — distinto de trocar a
     pergunta. Quem consome usa isto para não apagar (nem congelar) linhas que
     a pessoa já está lendo enquanto o scroll infinito busca a próxima página. */
  isAppending: false,
  error: "",
  // fincla-frontend#109 rodada 3, achado 2: canal SEPARADO pra falha ao
  // "carregar mais" (scroll infinito) — nunca pode contaminar `error`
  // (que `hasMore` abaixo usa pra decidir se continua oferecendo páginas).
  pageError: "",
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
  /* Nonce da recarga PEDIDA. Mora aqui e não fora porque quem sabe distinguir
     "recarregar" de "revalidar" é este hook — e a distinção é o que decide se
     acende carregamento. */
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);
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
    /* Recarregar É diferente de revalidar. `softRefreshOnly` existe para o
       stale-while-revalidate silencioso (uma transação salva em outra tela):
       ali NÃO se acende carregamento, de propósito, porque ninguém pediu nada.

       Quando a pessoa clica em "recarregar", ela pediu — e precisa ver que
       pediu. Sem este nonce a recarga caía no ramo silencioso: o botão não
       girava, a lista não recuava, a barra não aparecia, o `disabled` nunca
       engatava, e marteladas no botão disparavam N buscas concorrentes. */
    const recargaExplicita = prev != null && prev.reloadNonce !== reloadNonce;
    const softRefreshOnly =
      sameFilters &&
      !recargaExplicita &&
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
    /* "Mesmo contexto" NÃO é o mesmo que "carregando mais uma página": ele é
       verdadeiro para QUALQUER refetch da mesma pergunta, recarga explícita
       inclusive. Usá-lo sozinho como `isAppending` fazia a recarga se declarar
       paginação — e a página, que tira `isAppending` do sinal de carregamento
       justamente para o scroll infinito não apagar as linhas lidas, ficava
       muda: botão sem giro, lista sem recuo, barra sem aparecer.

       O que distingue os dois é o objeto `query`: o scroll infinito recalcula
       com `limit` maior, então ele muda de referência; a recarga não toca nele. */
    const carregandoMaisPaginas = samePaginationContext && prev.query !== query;

    prevFetchSig.current = {
      organizationId,
      query,
      summaryQuery,
      refreshToken,
      reloadNonce,
      browsingContextKey,
    };

    let cancelled = false;
    // fincla-frontend#109 rodada 4, achado 7: limpa `pageError` aqui também
    // (não só no sucesso) — sem isto, um `pageError` de uma tentativa
    // anterior sobrevive durante TODA a janela de uma nova tentativa (retry
    // ou uma consulta nova qualquer que passe pelo ramo `softRefreshOnly`),
    // e ele influencia a guarda de `hasMore` na página — teria vida mais
    // longa que a requisição que o criou.
    if (!softRefreshOnly) {
      setState((current) => ({
        ...current,
        isLoading: true,
        isAppending: carregandoMaisPaginas,
        error: "",
        pageError: "",
      }));
    } else {
      setState((current) => ({
        ...current,
        error: "",
        pageError: "",
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
          isAppending: false,
          error: "",
          pageError: "",
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
        setState((current) => {
          if (softRefreshOnly) {
            // Stale-while-revalidate de verdade (mesmo padrão do
            // `useCalendarData`): MESMA organização e MESMOS filtros — só o
            // `refreshToken` mudou (ex.: transação salva em outra tela). Os
            // dados na tela continuam válidos pra ESTE contexto, então
            // preserva (`...current`) e só o aviso de erro liga.
            return { ...current, isLoading: false, isAppending: false, error: message };
          }
          if (samePaginationContext) {
            // fincla-frontend#109 rodada 3, achado 2: uma falha ao "carregar
            // mais" (só `limit` cresceu — scroll infinito) NÃO pode virar o
            // `error` geral. `hasMore` (abaixo) força `false` quando
            // `state.error` está preenchido — se essa falha usasse o mesmo
            // canal, o scroll infinito morria pra sempre: a lista ficava
            // truncada (só as páginas já lidas) mas com CARA de completa
            // (sentinel/observer somem porque `hasMore` vira false), sem
            // nada re-disparando o fetch. Fica num canal PRÓPRIO
            // (`pageError`) — `error`/`hasLoaded`/`hasMore` continuam lendo
            // o estado de ANTES desta página, que é válido.
            return { ...current, isLoading: false, isAppending: false, pageError: message };
          }
          // Organização OU filtros de verdade mudaram (fincla-frontend#109
          // achado 3, rodada 1): `current` é de OUTRO contexto — preservar
          // aqui mostraria a lista/KPIs da organização ou do filtro ANTERIOR
          // sob os chips já trocados na tela, uma mentira silenciosa por
          // trás de um banner de erro. `hasLoaded` volta a `false`: este
          // contexto nunca carregou com sucesso.
          return {
            isLoading: false,
            isAppending: false,
            error: message,
            pageError: "",
            summary: null,
            transactions: [],
            total: 0,
            pagination: null,
            hasLoaded: false,
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, query, summaryQuery, refreshToken, reloadNonce]);

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

    // fincla-frontend#109 rodada 3, achado 2: um sinal EXPLÍCITO do backend
    // (`has_next`) tem prioridade sobre a heurística de tamanho de página
    // abaixo — precisa vir ANTES dela. Motivo: numa falha de "carregar
    // mais" (`pageError`), `state.transactions` fica com o tamanho da
    // ÚLTIMA PÁGINA QUE CARREGOU COM SUCESSO, menor que `query.limit` (a
    // página que falhou nunca chegou a preencher `state`) — "loaded <
    // limit" daria falso negativo bem na hora que mais importa saber que
    // AINDA HÁ mais páginas.
    if (next === false) return false;
    if (next === true) return true;

    // Sem sinal explícito, cai na heurística — mas só quando o `state`
    // atual reflete de fato o `limit` pedido (sem uma falha de página
    // pendente distorcendo a comparação).
    if (!state.pageError && !state.isLoading && loaded < limit) return false;

    return state.total > loaded;
  }, [
    query,
    state.error,
    state.pageError,
    state.isLoading,
    state.pagination,
    state.total,
    state.transactions.length,
  ]);

  /* O retorno é MEMOIZADO. Ele é objeto literal, então sem isto vira uma
     referência nova a cada render do consumidor — e a página o usa como
     dependência de `useMemo`/`useCallback` (as ações rápidas da linha, entre
     outros). O efeito medido: abrir a dock re-renderizava as 34 linhas DEZ
     vezes, porque cada render da página inventava um `transactionsData` novo e
     derrubava toda a memoização abaixo dele. */
  return useMemo(() => ({
    reload,
    isLoading: state.isLoading,
    isAppending: state.isAppending,
    error: state.error,
    pageError: state.pageError,
    hasLoaded: state.hasLoaded,
    summary: state.summary,
    transactions: state.transactions,
    total: state.total,
    hasMore,
    removeTransaction,
    setTransactionSettled,
  }), [reload, state, hasMore, removeTransaction, setTransactionSettled]);
}
