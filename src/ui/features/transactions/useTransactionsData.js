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
  TRANSACTIONS_API_MAX_LIMIT,
} from "../../data/transactionsAdapter.js";
import { withSliceCurrency } from "../export/sliceCurrency.js";
import { runWithConcurrency } from "./bulkMove/bulkMoveModel.js";

const EMPTY_STATE = {
  isLoading: false,
  /* Carregando MAIS uma página da mesma pergunta — distinto de trocar a
     pergunta. Quem consome usa isto para não apagar (nem congelar) linhas que
     a pessoa já está lendo enquanto o scroll infinito busca a próxima página. */
  isAppending: false,
  error: "",
  /* Código do erro da API (`{"error": "CREDIT_CARD_NOT_FOUND"}`), para a página reagir
     a um caso conhecido — ex.: cartão do filtro apagado em outra aba (#280). */
  errorCode: "",
  // fincla-frontend#109 rodada 3, achado 2: canal SEPARADO pra falha ao
  // "carregar mais" (scroll infinito) — nunca pode contaminar `error`
  // (que `hasMore` abaixo usa pra decidir se continua oferecendo páginas).
  pageError: "",
  /* G3-P-01: a releitura em SEGUNDO PLANO (mesma pergunta) falhou. As linhas
     da tela continuam valendo e a rolagem segue; isto é só um aviso discreto. */
  refreshError: "",
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

/** `{"error": "CODE"}` da resposta da API (ou `detail.error`), senão "". */
function apiErrorCodeOf(error) {
  const data = error?.response?.data;
  const code = data?.error ?? data?.detail?.error;
  return typeof code === "string" ? code : "";
}

/** Tamanho da página = o `limit` pedido, nunca acima do teto do servidor. */
function pageSizeOf(query) {
  const limit = Math.floor(Number(query?.limit));
  return Math.min(TRANSACTIONS_API_MAX_LIMIT, Math.max(1, Number.isFinite(limit) && limit > 0 ? limit : 10));
}

/* Releituras de várias páginas (revalidação depois de rolar muito) saem em
   lotes pequenos, não todas de uma vez contra o servidor. */
const PAGE_REQUESTS_IN_PARALLEL = 4;

function abortedError() {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

/** Páginas `fromPage..toPage` da pergunta, todas com o mesmo `limit`, na ordem.
    Devolve `{ ok, value | error }` por página (`runWithConcurrency`): uma
    página que falha não apaga as outras. Com `signal` abortado, nenhuma página
    ainda na fila sai — os pedidos já em voo são cancelados pelo próprio sinal. */
function fetchPageRange(query, fromPage, toPage, limit, signal) {
  const pages = [];
  for (let page = fromPage; page <= toPage; page += 1) pages.push(page);
  return runWithConcurrency(pages, PAGE_REQUESTS_IN_PARALLEL, (page) => {
    if (signal?.aborted) throw abortedError();
    return listTransactionsForUi({ ...query, page, limit }, { signal });
  });
}

function firstFailure(results) {
  return results.find((result) => !result.ok)?.error ?? null;
}

function valuesOf(results) {
  return results.map((result) => result.value);
}

function rowsOf(responses) {
  return responses.flatMap((response) => (response?.data ?? []).map(mapApiTransactionToUi));
}

/* Paginação por posição: um lançamento criado no topo entre uma página e
   outra empurra a última linha lida para a página seguinte. O id decide. */
function appendUnique(current, incoming) {
  const seen = new Set(current.map((row) => String(row.id)));
  const out = [...current];
  for (const row of incoming) {
    const key = String(row.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/* Há mais páginas? O sinal explícito do servidor (`has_next` da última página
   lida) vence; sem ele, o total contra o que já está na mão. */
function hasMoreRows(state) {
  if (!state.hasLoaded || state.error) return false;
  const next = state.pagination?.has_next;
  if (next === false) return false;
  if (next === true) return true;
  return state.total > state.transactions.length;
}

function freshPaging(contextKey, generation) {
  return {
    contextKey, pagesLoaded: 0, removed: 0, generation,
    appending: null, appendController: null, reading: null, tail: [],
  };
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
  /* Paginação do scroll infinito (fincla-api#535). Mora num ref porque é lida
     e escrita fora do render (no `then` de cada página) e não decide nada que
     a tela desenhe — quem desenha lê `state`.
     - `contextKey`: a pergunta sem `page`. Mudou → recomeça da página 1.
     - `pagesLoaded`: quantas páginas desta pergunta estão em `state.transactions`.
     - `removed`: linhas excluídas aqui desde a última leitura. Cada uma empurra
       uma linha do servidor para a página anterior; a próxima busca relê o
       trecho para não pular ninguém.
     - `generation`: sobe a cada leitura nova da pergunta; a resposta de uma
       página pedida antes disso é descartada.
     - `appending`: geração de uma página em voo (guarda síncrona contra dois
       pedidos da mesma página); `appendController` cancela esse pedido.
     - `reading`: geração de uma leitura (1..N) ainda em voo; `tail` guarda as
       linhas que a rolagem somou ENQUANTO ela voava, para a leitura não
       apagá-las ao chegar (G3-P-04). */
  const pagingRef = useRef(freshPaging(null, 0));
  /* Os sinais de recarga da ÚLTIMA execução do efeito, para distinguir
     "recarregar" (pedido explícito, acende carregamento) de "revalidar"
     (`refreshToken`, silencioso). */
  const prevSignalsRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* As consultas são identificadas pelo CONTEÚDO, não pela referência de `filters`:
     a página recalcula o objeto quando qualquer dependência muda (a moeda base
     chegando, a lista de cartões chegando) mesmo que a pergunta seja a mesma — e
     cada referência nova era uma lista + um resumo pedidos de novo (#293). */
  const queryKey = JSON.stringify(organizationId ? buildTransactionsQuery({ organizationId, ...filters }) : null);
  /* Transações abre o painel de exportação: o resumo segue a regra de moeda do arquivo (fincla-api#520, D1). */
  const summaryQueryKey = JSON.stringify(
    organizationId ? withSliceCurrency(buildTransactionsSummaryQuery({ organizationId, ...filters })) : null,
  );
  const query = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const summaryQuery = useMemo(() => JSON.parse(summaryQueryKey), [summaryQueryKey]);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    if (!enabled || !organizationId || !query || !summaryQuery) {
      setState(EMPTY_STATE);
      pagingRef.current.appendController?.abort();
      pagingRef.current = freshPaging(null, pagingRef.current.generation + 1);
      prevSignalsRef.current = null;
      return;
    }

    const { page: _page, ...queryWithoutPage } = query;
    const contextKey = JSON.stringify({ organizationId, query: queryWithoutPage, summaryQuery });
    const paging = pagingRef.current;
    const prev = prevSignalsRef.current;
    const sameContext = paging.contextKey === contextKey;
    /* Recarregar É diferente de revalidar. `softRefreshOnly` existe para o
       stale-while-revalidate silencioso (uma transação salva em outra tela):
       ali NÃO se acende carregamento, de propósito, porque ninguém pediu nada.
       Quando a pessoa clica em "recarregar", ela pediu — e precisa ver que
       pediu (o botão gira, a lista recua, o `disabled` engata). */
    const explicitReload = prev != null && prev.reloadNonce !== reloadNonce;
    const softRefreshOnly =
      sameContext && !explicitReload && prev != null && prev.refreshToken !== refreshToken;
    prevSignalsRef.current = { refreshToken, reloadNonce };

    /* Reler a MESMA pergunta relê as páginas que a pessoa já rolou, uma a uma
       com o mesmo `limit`: um pedido só com `limit` maior passaria do teto do
       servidor, e reler só a página 1 cortaria a lista que ela está lendo. */
    const pagesToLoad = sameContext ? Math.max(1, paging.pagesLoaded) : 1;
    const generation = paging.generation + 1;
    /* Uma página em voo da leitura anterior seria descartada pela geração de
       qualquer jeito: cancelar libera o servidor (1 worker) para esta leitura. */
    paging.appendController?.abort();
    pagingRef.current = sameContext
      ? { ...paging, generation, appending: null, appendController: null, reading: generation, tail: [] }
      : { ...freshPaging(contextKey, generation), reading: generation };

    let cancelled = false;
    /* G3-P-01: a leitura superada (outro refresh, troca de filtro ou de
       organização, desmontagem) é CANCELADA, não só ignorada — senão seus
       pedidos ficam na fila do servidor na frente da página 1 da pergunta nova. */
    const controller = new AbortController();
    /* `pageError` limpa no INÍCIO de qualquer leitura nova (não só no sucesso):
       ele esconde a sentinela, então não pode viver mais que o pedido que o
       criou. Uma página em voo da leitura anterior é descartada pela geração. */
    setState((current) => ({
      ...current,
      isLoading: softRefreshOnly ? current.isLoading && !current.isAppending : true,
      isAppending: false,
      error: "",
      errorCode: "",
      pageError: "",
      refreshError: "",
    }));

    const limit = pageSizeOf(query);
    const { signal } = controller;
    Promise.all([
      fetchPageRange(query, 1, pagesToLoad, limit, signal),
      getTransactionsSummaryForUi(summaryQuery, { signal }).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error }),
      ),
    ])
      .then(([pageResults, summaryResult]) => {
        if (cancelled || pagingRef.current.generation !== generation) return;

        const failure = firstFailure(pageResults) ?? (summaryResult.ok ? null : summaryResult.error);
        const { tail, pagesLoaded: pagesNow, appending } = pagingRef.current;
        if (failure) {
          pagingRef.current = { ...pagingRef.current, reading: null, tail: [] };
          throw failure;
        }

        const responses = valuesOf(pageResults);
        /* A rolagem pode ter somado páginas além de `pagesToLoad` enquanto
           esta leitura voava: elas ficam no fim, sem piscar (G3-P-04). */
        const grewMeanwhile = pagesNow > pagesToLoad;
        const transactions = appendUnique(appendUnique([], rowsOf(responses)), grewMeanwhile ? tail : []);
        const appendInFlight = appending === generation;
        pagingRef.current = {
          ...pagingRef.current,
          pagesLoaded: Math.max(pagesToLoad, pagesNow),
          removed: 0,
          reading: null,
          tail: [],
        };
        setState((current) => {
          const pagination = grewMeanwhile ? current.pagination : (responses.at(-1)?.pagination ?? null);
          return {
            isLoading: appendInFlight,
            isAppending: appendInFlight,
            error: "",
            errorCode: "",
            pageError: "",
            refreshError: "",
            summary: summaryResult.value,
            transactions,
            total: pagination?.total ?? transactions.length,
            pagination,
            hasLoaded: true,
          };
        });
      })
      .catch((error) => {
        if (cancelled || pagingRef.current.generation !== generation) return;

        const message = formatTransactionsApiError(error);
        const errorCode = apiErrorCodeOf(error);
        setState((current) => {
          if (sameContext && current.hasLoaded) {
            // G3-P-01: MESMA organização e MESMOS filtros, com linhas já lidas.
            // Nada da leitura entra pela metade (uma página nova ao lado de uma
            // velha mistura posições): a lista fica como está, a rolagem segue
            // e só um aviso discreto liga. `errorCode` vale para a página reagir
            // a um caso conhecido (cartão do filtro apagado em outra aba).
            return { ...current, isLoading: false, isAppending: false, refreshError: message, errorCode };
          }
          if (sameContext) {
            // Ainda não havia leitura boa deste contexto: é o erro geral.
            return { ...current, isLoading: false, isAppending: false, error: message, errorCode };
          }
          // Organização OU filtros mudaram (fincla-frontend#109 achado 3):
          // `current` é de OUTRO contexto — preservar mostraria a lista/KPIs do
          // anterior sob os chips já trocados. `hasLoaded` volta a `false`.
          return {
            isLoading: false,
            isAppending: false,
            error: message,
            errorCode,
            pageError: "",
            refreshError: "",
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
      controller.abort();
    };
  }, [enabled, organizationId, query, summaryQuery, refreshToken, reloadNonce]);

  // Desmontar cancela também a página em voo do scroll infinito.
  useEffect(() => () => pagingRef.current.appendController?.abort(), []);

  /* Pede a página seguinte à última lida e SOMA as linhas. Falha vai para o
     canal próprio `pageError` (fincla-frontend#109 rodada 3, achado 2): as
     linhas lidas ficam, `error`/`hasMore` continuam valendo, e só uma ação
     explícita (`retryPage`) pede a página de novo. */
  const fetchNextPage = useCallback(() => {
    const start = () => {
      const paging = pagingRef.current;
      const currentQuery = queryRef.current;
      if (!currentQuery || paging.contextKey == null || paging.pagesLoaded < 1) return;
      if (paging.appending === paging.generation) return;

      const { generation, removed } = paging;
      const limit = pageSizeOf(currentQuery);
      const nextPage = paging.pagesLoaded + 1;
      const fromPage = Math.max(1, nextPage - Math.ceil(removed / limit));
      const controller = new AbortController();
      paging.appending = generation;
      paging.appendController = controller;
      setState((current) => ({ ...current, isLoading: true, isAppending: true, pageError: "" }));

      fetchPageRange(currentQuery, fromPage, nextPage, limit, controller.signal).then((results) => {
        if (controller.signal.aborted || pagingRef.current.generation !== generation) return;
        const latest = pagingRef.current;
        /* G3-P-05: uma exclusão confirmada enquanto a página voava moveu as
           fronteiras das páginas por baixo desta leitura — a linha que subiu
           para a página anterior não estaria nela. Lê de novo, já contando a
           exclusão (o trecho começa uma página antes). */
        if (latest.removed !== removed) {
          pagingRef.current = { ...latest, appending: null, appendController: null };
          start();
          return;
        }
        const failure = firstFailure(results);
        if (failure) {
          pagingRef.current = { ...latest, appending: null, appendController: null };
          setState((current) => ({
            ...current,
            isLoading: false,
            isAppending: false,
            pageError: formatTransactionsApiError(failure),
            errorCode: apiErrorCodeOf(failure),
          }));
          return;
        }
        const responses = valuesOf(results);
        const rows = rowsOf(responses);
        pagingRef.current = {
          ...latest,
          pagesLoaded: nextPage,
          removed: 0,
          appending: null,
          appendController: null,
          // Uma leitura 1..N em voo trocará a lista: estas linhas vão junto (G3-P-04).
          tail: latest.reading === generation ? [...latest.tail, ...rows] : latest.tail,
        };
        const pagination = responses.at(-1)?.pagination ?? null;
        setState((current) => ({
          ...current,
          isLoading: false,
          isAppending: false,
          pageError: "",
          transactions: appendUnique(current.transactions, rows),
          total: pagination?.total ?? current.total,
          pagination: pagination ?? current.pagination,
        }));
      });
    };
    start();
  }, []);

  const loadMore = useCallback(() => {
    const current = stateRef.current;
    if (current.isLoading || current.pageError || !hasMoreRows(current)) return;
    fetchNextPage();
  }, [fetchNextPage]);

  /** "Tentar novamente": a MESMA página que falhou, sem reler as anteriores. */
  const retryPage = useCallback(() => {
    if (!stateRef.current.pageError) return;
    fetchNextPage();
  }, [fetchNextPage]);


  const removeTransaction = useCallback(async (transactionId) => {
    if (!organizationId) return;

    try {
      await deleteTransactionForUi(transactionId, organizationId);
      pagingRef.current = { ...pagingRef.current, removed: pagingRef.current.removed + 1 };
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

  const hasMore = useMemo(() => Boolean(query) && hasMoreRows(state), [query, state]);

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
    errorCode: state.errorCode,
    pageError: state.pageError,
    refreshError: state.refreshError,
    hasLoaded: state.hasLoaded,
    summary: state.summary,
    transactions: state.transactions,
    total: state.total,
    hasMore,
    loadMore,
    retryPage,
    removeTransaction,
    setTransactionSettled,
  }), [reload, state, hasMore, loadMore, retryPage, removeTransaction, setTransactionSettled]);
}
