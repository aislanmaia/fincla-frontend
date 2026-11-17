// @vitest-environment jsdom
//
// fincla-frontend#78 / #80 — verificação ponta a ponta dos filtros de Tags e
// Situação na tela de Transações, no nível onde o bug de fato mora: a chamada
// HTTP que o cliente da API recebe.
//
// Método (Owner, por ter sido mordido 2x): não mockar a costura que interessa.
// `buildTransactionsQuery` / `filtersToLegacyParams` / `useTransactionsData`
// rodam de VERDADE aqui — só o limite de rede (`listTransactions` /
// `getTransactionsSummary`, que chamam `apiClient.get`) é dublado, para
// inspecionar os params exatos que sairiam na querystring.
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { useTransactionsData } from "../useTransactionsData.js";
import { filtersToLegacyParams } from "../filters/filtersToLegacyParams.js";
import { deleteTransaction, listTransactions, getTransactionsSummary } from "../../../../api/transactions";

vi.mock("../../../../api/transactions", () => ({
  listTransactions: vi.fn(),
  getTransactionsSummary: vi.fn(),
  deleteTransaction: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const TAG_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const EMPTY_PAGE = { data: [], pagination: { total: 0, has_next: false } };
const EMPTY_SUMMARY = { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0 };

const BASE_STATE = {
  type: "todos",
  method: [],
  cats: [],
  period: "tudo",
  customFrom: "",
  customTo: "",
  sort: [{ field: "date", dir: "desc" }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWithFilters(state, options) {
  const filters = filtersToLegacyParams(state, { limit: 10, ...options });
  return renderHook(() =>
    useTransactionsData({ organizationId: ORG, enabled: true, filters }),
  );
}

describe("fincla-frontend#80 — facet Situação chega como `settled` na chamada HTTP", () => {
  it("'a-pagar' -> settled=false na chamada real de listTransactions/getTransactionsSummary", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters({ ...BASE_STATE, settlement: "a-pagar" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORG, settled: false }),
    );
    expect(getTransactionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORG, settled: false }),
    );
  });

  it("'pagas' -> settled=true", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters({ ...BASE_STATE, settlement: "pagas" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ settled: true }),
    );
  });

  it("'todas' OMITE o param (regressão: settled=undefined vazaria na querystring)", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters({ ...BASE_STATE, settlement: "todas" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sentParams = listTransactions.mock.calls[0][0];
    expect(sentParams).not.toHaveProperty("settled");
  });
});

describe("facet Tags chega como `tag_id` na chamada HTTP", () => {
  it("tag selecionada (id já resolvido pelo chamador) -> tag_id na chamada real", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    // Reproduz o que TransacoesPage faz: resolve o NOME da facet Tags para um id
    // (via catálogo de tags) e manda como `tagIds` — antes da correção esse
    // valor nunca era lido em lugar nenhum e a seleção morria no estado local.
    const { result } = renderWithFilters(BASE_STATE, { tagIds: [TAG_ID] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORG, tag_id: [TAG_ID] }),
    );
    expect(getTransactionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: [TAG_ID] }),
    );
  });

  it("nenhuma tag selecionada -> não manda tag_id nem category por engano", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters(BASE_STATE, { tagIds: [] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sentParams = listTransactions.mock.calls[0][0];
    expect(sentParams).not.toHaveProperty("tag_id");
    expect(sentParams).not.toHaveProperty("category");
  });

  it("categoria e tag selecionadas viajam JUNTAS — o backend faz AND entre elas", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const CAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { result } = renderWithFilters(
      { ...BASE_STATE, cats: [CAT_ID] },
      { tagIds: [TAG_ID] },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Os dois são UUID, então caem no mesmo param repetido: a lista traz o que
    // tiver QUALQUER uma das duas tags. Antes só `CAT_ID` era enviado e o chip
    // da tag ficava aceso filtrando nada.
    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: [CAT_ID, TAG_ID] }),
    );
  });

  it("manda TODAS as tags resolvidas, não só a primeira", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const SECOND = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const { result } = renderWithFilters(BASE_STATE, { tagIds: [TAG_ID, SECOND] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: [TAG_ID, SECOND] }),
    );
  });
});

// fincla-frontend#106 — a LISTA não distinguia "carregando"/"erro" de "vazio
// de verdade": na 1ª carga, antes da resposta chegar, `transactions` já é []
// e a tela lia isso como "nenhuma transação encontrada" (falso). `hasLoaded`
// só vira `true` num sucesso (mesmo padrão do `useCalendarData`), e uma
// revalidação que falha preserva os dados anteriores (stale-while-revalidate)
// em vez de apagar a lista.
describe("fincla-frontend#106 — hasLoaded distingue carregando/erro de vazio de verdade", () => {
  it("começa false e só vira true depois de um sucesso", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters(BASE_STATE);

    // Antes do efeito resolver, a 1ª carga nunca teve sucesso.
    expect(result.current.hasLoaded).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLoaded).toBe(true);
  });

  it("falha na 1ª carga: hasLoaded continua false e transactions continua vazio", async () => {
    listTransactions.mockRejectedValue(new Error("network down"));
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters(BASE_STATE);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.transactions).toEqual([]);
  });

  it("stale-while-revalidate: revalidação que falha preserva os dados da carga anterior", async () => {
    const ROW = {
      id: "tx-1",
      description: "Café",
      amount: -10,
      type: "expense",
      date: "2026-08-01",
      tags: {},
    };
    listTransactions.mockResolvedValueOnce({
      data: [ROW],
      pagination: { total: 1, has_next: false },
    });
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const filters = filtersToLegacyParams(BASE_STATE, { limit: 10 });
    const { result, rerender } = renderHook(
      ({ refreshToken }) =>
        useTransactionsData({ organizationId: ORG, enabled: true, filters, refreshToken }),
      { initialProps: { refreshToken: 0 } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.transactions).toHaveLength(1);

    // Revalidação (mesmos filtros, `refreshToken` bumpado) falha.
    listTransactions.mockRejectedValueOnce(new Error("network down"));
    rerender({ refreshToken: 1 });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    // A implementação ANTERIOR zerava `transactions`/`total` no catch — a
    // lista sumia da tela sob uma falha de revalidação, mesmo com dados
    // válidos ainda na mão. `hasLoaded` continua true: já carregamos com
    // sucesso ao menos uma vez.
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe("tx-1");
  });
});

// fincla-frontend#109 achado 2 (revisão da PR #109) — a correção acima do
// #106 não valia no 1º quadro: `EMPTY_STATE.isLoading` era `false`, e só o
// `useEffect` ligava. `renderHook`/`render` do RTL flusham efeitos dentro do
// MESMO `act()` da montagem — não dá pra observar o estado ANTES do efeito
// por esse caminho (mesma limitação já documentada no teste equivalente de
// `useTransactionsTagCatalog.test.js`). `renderToStaticMarkup` (SSR) nunca
// roda `useEffect`, então captura exatamente o 1º quadro que importa.
describe("fincla-frontend#109 achado 2 — isLoading já começa true no 1º quadro (SSR)", () => {
  it("enabled+organizationId: isLoading true, hasLoaded false, sem rodar o efeito", () => {
    function Probe() {
      const { isLoading, hasLoaded } = useTransactionsData({
        organizationId: ORG,
        enabled: true,
        filters: filtersToLegacyParams(BASE_STATE, { limit: 10 }),
      });
      return `${isLoading}|${hasLoaded}`;
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe("true|false");
  });

  it("sem organizationId: isLoading fica false (não há nada pra carregar)", () => {
    function Probe() {
      const { isLoading } = useTransactionsData({
        organizationId: null,
        enabled: true,
        filters: filtersToLegacyParams(BASE_STATE, { limit: 10 }),
      });
      return String(isLoading);
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe("false");
  });

  it("enabled=false: isLoading fica false", () => {
    function Probe() {
      const { isLoading } = useTransactionsData({
        organizationId: ORG,
        enabled: false,
        filters: filtersToLegacyParams(BASE_STATE, { limit: 10 }),
      });
      return String(isLoading);
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe("false");
  });
});

// fincla-frontend#109 achado 3 — o `.catch` mesclava `...current`
// INCONDICIONALMENTE, mesmo quando organização OU filtros mudaram (não só
// numa revalidação de verdade do MESMO contexto). Uma falha ao trocar de
// organização deixava a lista/summary da organização ANTERIOR na tela, com
// `hasLoaded:true`, como se fossem dados válidos da organização NOVA.
describe("fincla-frontend#109 achado 3 — falha ao trocar de contexto não herda dados do contexto anterior", () => {
  it("falha ao trocar de ORGANIZAÇÃO: não preserva transactions/summary/hasLoaded da organização anterior", async () => {
    const ORG_B = "22222222-2222-4222-8222-222222222222";
    const ROW = {
      id: "tx-org-a",
      description: "Café org A",
      amount: -10,
      type: "expense",
      date: "2026-08-01",
      tags: {},
    };
    listTransactions.mockResolvedValueOnce({
      data: [ROW],
      pagination: { total: 1, has_next: false },
    });
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const filters = filtersToLegacyParams(BASE_STATE, { limit: 10 });
    const { result, rerender } = renderHook(
      ({ organizationId }) => useTransactionsData({ organizationId, enabled: true, filters }),
      { initialProps: { organizationId: ORG } },
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.transactions).toHaveLength(1);

    // Troca de organização — a busca da nova organização falha.
    listTransactions.mockRejectedValueOnce(new Error("network down"));
    rerender({ organizationId: ORG_B });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    // Não pode mostrar as linhas da organização A sob o contexto da B — isso
    // é uma mentira silenciosa por trás de um banner de erro.
    expect(result.current.transactions).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.summary).toBeNull();
    expect(result.current.hasLoaded).toBe(false);
  });

  it("falha ao trocar de FILTRO (mesma organização): não preserva a lista do filtro anterior", async () => {
    const ROW = {
      id: "tx-filtro-a",
      description: "Café filtro A",
      amount: -10,
      type: "expense",
      date: "2026-08-01",
      tags: {},
    };
    listTransactions.mockResolvedValueOnce({
      data: [ROW],
      pagination: { total: 1, has_next: false },
    });
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    // `filters` precisa ser uma referência ESTÁVEL entre renders (calculada
    // FORA do callback do `renderHook`) — computá-la de novo a cada chamada
    // recria `query`/`summaryQuery` (via `useMemo`) a cada render, o efeito
    // vê a dependência "mudar" pra sempre e entra num loop infinito de
    // fetch/render (não é o hook: é um erro de autoria do teste).
    const filtersA = filtersToLegacyParams(BASE_STATE, { limit: 10 });
    const filtersB = filtersToLegacyParams({ ...BASE_STATE, type: "despesa" }, { limit: 10 });

    const { result, rerender } = renderHook(
      ({ filters }) => useTransactionsData({ organizationId: ORG, enabled: true, filters }),
      { initialProps: { filters: filtersA } },
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.transactions).toHaveLength(1);

    listTransactions.mockRejectedValueOnce(new Error("network down"));
    rerender({ filters: filtersB });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.transactions).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
  });
});

// fincla-api#535 — o scroll infinito pede a PRÓXIMA PÁGINA (`page` crescente,
// `limit` fixo no tamanho da página) e SOMA as linhas. Antes ele só aumentava
// o `limit` do mesmo pedido (10, 20… 100) e parava em 100 — o máximo que o
// servidor aceita — com o cabeçalho anunciando o total real.
//
// O servidor aqui é um dublê que pagina de verdade: devolve a fatia
// `[(page-1)*limit, page*limit)` e um `pagination` como o da API.
const PAGE_LIMIT = 10;

function apiRow(id) {
  return { id, description: `Item ${id}`, amount: -10, type: "expense", date: "2026-08-01", tags: {} };
}

/** Lista "do servidor", mutável pelo teste (inserir no topo, apagar). */
function serveRows(rows, { failOnce = new Set() } = {}) {
  listTransactions.mockImplementation(async (q) => {
    const page = Number(q.page);
    const limit = Number(q.limit);
    if (failOnce.has(page)) {
      failOnce.delete(page);
      throw new Error("network down");
    }
    const total = rows.length;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  });
  getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
}

const pagesRequested = () => listTransactions.mock.calls.map(([q]) => [q.page, q.limit]);
const loadedIds = (result) => result.current.transactions.map((t) => String(t.id));
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

function renderPaged(initialProps = {}) {
  const filters = filtersToLegacyParams(BASE_STATE, { limit: PAGE_LIMIT });
  return renderHook(
    ({ organizationId = ORG, filters: f = filters, refreshToken = 0 }) =>
      useTransactionsData({ organizationId, enabled: true, filters: f, refreshToken }),
    { initialProps },
  );
}

async function loadNext(result) {
  const before = result.current.transactions.length;
  const calls = listTransactions.mock.calls.length;
  act(() => result.current.loadMore());
  await waitFor(() => expect(listTransactions.mock.calls.length).toBeGreaterThan(calls));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result.current.transactions.length - before;
}

describe("fincla-api#535 — scroll infinito pede page 2, 3… com o mesmo limit e acumula", () => {
  it("sequência de pedidos: page 1, 2, 3 — todos com limit = tamanho da página — e as linhas somam", async () => {
    serveRows(Array.from({ length: 45 }, (_, i) => apiRow(i + 1)));
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(loadedIds(result)).toEqual(range(1, 10));

    await loadNext(result);
    await loadNext(result);

    expect(pagesRequested()).toEqual([[1, 10], [2, 10], [3, 10]]);
    expect(loadedIds(result)).toEqual(range(1, 30));
    expect(result.current.total).toBe(45);
    expect(result.current.hasMore).toBe(true);
    // Carregar mais NÃO repete o resumo: é a mesma pergunta.
    expect(getTransactionsSummary).toHaveBeenCalledTimes(1);
  });

  it("510 lançamentos: carrega os 510 e, no fim, hasMore=false e nenhum pedido a mais", async () => {
    serveRows(Array.from({ length: 510 }, (_, i) => apiRow(i + 1)));
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    let guard = 0;
    while (result.current.hasMore && guard < 60) {
      guard += 1;
      await loadNext(result);
    }

    expect(loadedIds(result)).toEqual(range(1, 510));
    expect(result.current.hasMore).toBe(false);
    expect(pagesRequested()).toEqual(Array.from({ length: 51 }, (_, i) => [i + 1, PAGE_LIMIT]));

    const calls = listTransactions.mock.calls.length;
    act(() => result.current.loadMore());
    await new Promise((r) => setTimeout(r, 20));
    expect(listTransactions).toHaveBeenCalledTimes(calls);
  });

  it("nenhum pedido sai com limit acima do tamanho da página, nem com limit acima de 100", async () => {
    serveRows(Array.from({ length: 300 }, (_, i) => apiRow(i + 1)));
    const filters = filtersToLegacyParams(BASE_STATE, { limit: 250 });
    const { result } = renderPaged({ filters });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await loadNext(result);
    for (const [, limit] of pagesRequested()) expect(limit).toBeLessThanOrEqual(100);
    expect(loadedIds(result)).toEqual(range(1, 200));
  });

  it("dois 'carregar mais' no mesmo instante pedem a página seguinte UMA vez", async () => {
    serveRows(Array.from({ length: 45 }, (_, i) => apiRow(i + 1)));
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.transactions).toHaveLength(20));
    expect(pagesRequested()).toEqual([[1, 10], [2, 10]]);
  });

  it("trocar o FILTRO recomeça da página 1 e descarta as páginas do recorte anterior", async () => {
    serveRows(Array.from({ length: 45 }, (_, i) => apiRow(i + 1)));
    const { result, rerender } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await loadNext(result);
    await loadNext(result);
    expect(result.current.transactions).toHaveLength(30);

    listTransactions.mockClear();
    rerender({ filters: filtersToLegacyParams({ ...BASE_STATE, type: "despesa" }, { limit: PAGE_LIMIT }) });
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions.mock.calls[0][0]).toMatchObject({ page: 1, limit: 10, type: "expense" });
    expect(loadedIds(result)).toEqual(range(1, 10));

    // E o próximo "carregar mais" é a página 2 do recorte NOVO, não a 4.
    await loadNext(result);
    expect(listTransactions.mock.calls.at(-1)[0]).toMatchObject({ page: 2, limit: 10, type: "expense" });
  });

  it("trocar a ORGANIZAÇÃO recomeça da página 1", async () => {
    const ORG_B = "22222222-2222-4222-8222-222222222222";
    serveRows(Array.from({ length: 45 }, (_, i) => apiRow(i + 1)));
    const { result, rerender } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await loadNext(result);

    listTransactions.mockClear();
    rerender({ organizationId: ORG_B });
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listTransactions.mock.calls[0][0]).toMatchObject({ organization_id: ORG_B, page: 1, limit: 10 });
    expect(result.current.transactions).toHaveLength(10);
  });

  it("um 'carregar mais' em voo quando o filtro troca não mistura linhas do recorte anterior", async () => {
    serveRows(Array.from({ length: 45 }, (_, i) => apiRow(i + 1)));
    const { result, rerender } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    let releasePage2;
    listTransactions.mockImplementationOnce(
      () => new Promise((resolve) => {
        releasePage2 = () => resolve({ data: [apiRow(999)], pagination: { page: 2, limit: 10, total: 45, has_next: true } });
      }),
    );
    act(() => result.current.loadMore());
    await waitFor(() => expect(releasePage2).toBeTypeOf("function"));

    rerender({ filters: filtersToLegacyParams({ ...BASE_STATE, type: "despesa" }, { limit: PAGE_LIMIT }) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => releasePage2());
    await new Promise((r) => setTimeout(r, 20));

    expect(loadedIds(result)).toEqual(range(1, 10));
  });
});

describe("fincla-api#535 — atualizar em segundo plano não duplica nem perde linhas", () => {
  it("refreshToken novo relê as páginas JÁ carregadas (1..3, mesmo limit) e troca as linhas, sem duplicar", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => apiRow(i + 1));
    serveRows(rows);
    const { result, rerender } = renderPaged({ refreshToken: 0 });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await loadNext(result);
    await loadNext(result);

    // Outra tela criou um lançamento que cai no topo.
    rows.unshift(apiRow(1000));
    listTransactions.mockClear();
    rerender({ refreshToken: 1 });
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(loadedIds(result)[0]).toBe("1000"));

    expect(pagesRequested().sort()).toEqual([[1, 10], [2, 10], [3, 10]]);
    expect(loadedIds(result)).toEqual(["1000", ...range(1, 29)]);
    expect(result.current.total).toBe(46);
    expect(result.current.hasMore).toBe(true);

    // E a rolagem continua da página 4.
    await loadNext(result);
    expect(listTransactions.mock.calls.at(-1)[0]).toMatchObject({ page: 4, limit: 10 });
    expect(loadedIds(result)).toEqual(["1000", ...range(1, 39)]);
  });

  it("um lançamento novo no topo ENTRE uma página e outra não aparece duas vezes", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => apiRow(i + 1));
    serveRows(rows);
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    rows.unshift(apiRow(1000)); // a página 2 agora começa no 10, que já está na tela
    await loadNext(result);

    const ids = loadedIds(result);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(range(1, 19));
  });

  it("excluir uma linha e rolar não pula o lançamento que subiu para a página anterior", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => apiRow(i + 1));
    serveRows(rows);
    deleteTransaction.mockImplementation(async (id) => {
      const at = rows.findIndex((r) => String(r.id) === String(id));
      if (at >= 0) rows.splice(at, 1);
    });
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() => result.current.removeTransaction(3));
    await loadNext(result);

    // O 11 subiu para a página 1 no servidor; a página 2 agora começa no 12.
    expect(loadedIds(result)).toEqual([...range(1, 2), ...range(4, 21)]);
    for (const [, limit] of pagesRequested()) expect(limit).toBe(10);
  });
});

describe("fincla-api#535 — falha numa página: as linhas ficam e 'Tentar novamente' pede AQUELA página", () => {
  it("página 2 falha: linhas da 1 ficam, pageError liga, error geral não, hasMore segue true", async () => {
    serveRows(Array.from({ length: 30 }, (_, i) => apiRow(i + 1)), { failOnce: new Set([2]) });
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.pageError).toBeTruthy());

    expect(loadedIds(result)).toEqual(range(1, 10));
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.error).toBe("");
    expect(result.current.hasMore).toBe(true);
  });

  it("retryPage pede a MESMA página (2, limit 10), soma as linhas e limpa o pageError", async () => {
    serveRows(Array.from({ length: 30 }, (_, i) => apiRow(i + 1)), { failOnce: new Set([2]) });
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.pageError).toBeTruthy());

    act(() => result.current.retryPage());
    await waitFor(() => expect(result.current.transactions).toHaveLength(20));

    expect(pagesRequested()).toEqual([[1, 10], [2, 10], [2, 10]]);
    expect(loadedIds(result)).toEqual(range(1, 20));
    expect(result.current.pageError).toBe("");
    expect(getTransactionsSummary).toHaveBeenCalledTimes(1);
  });

  it("o pageError apaga no INÍCIO da nova tentativa, antes de ela responder", async () => {
    serveRows(Array.from({ length: 30 }, (_, i) => apiRow(i + 1)), { failOnce: new Set([2]) });
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.pageError).toBeTruthy());

    let release;
    listTransactions.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = () => resolve({ data: [apiRow(11)], pagination: { page: 2, limit: 10, total: 11, has_next: false } });
      }),
    );
    act(() => result.current.retryPage());
    await waitFor(() => expect(result.current.pageError).toBe(""));
    expect(result.current.isLoading).toBe(true);
    act(() => release());
    await waitFor(() => expect(result.current.transactions).toHaveLength(11));
  });

  it("enquanto a página está com erro, 'carregar mais' não dispara sozinho (só o retry)", async () => {
    serveRows(Array.from({ length: 30 }, (_, i) => apiRow(i + 1)), { failOnce: new Set([2]) });
    const { result } = renderPaged();
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.pageError).toBeTruthy());
    const calls = listTransactions.mock.calls.length;
    act(() => result.current.loadMore());
    await new Promise((r) => setTimeout(r, 20));
    expect(listTransactions).toHaveBeenCalledTimes(calls);
  });
});

describe("#280 — filtro Cartão chega como credit_card_id (repetível) na chamada HTTP", () => {
  it("um cartão → credit_card_id [5] na lista E no resumo", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const { result } = renderWithFilters({ ...BASE_STATE, cardSel: ["5"] });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(listTransactions.mock.calls[0][0]).toMatchObject({ credit_card_id: [5] });
    expect(getTransactionsSummary.mock.calls[0][0]).toMatchObject({ credit_card_id: [5] });
  });

  it("dois cartões → credit_card_id [5, 7]; ids que não são número não viajam", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const { result } = renderWithFilters({ ...BASE_STATE, cardSel: ["5", "Nubank ••1234", "7"] });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(listTransactions.mock.calls[0][0].credit_card_id).toEqual([5, 7]);
    expect(getTransactionsSummary.mock.calls[0][0].credit_card_id).toEqual([5, 7]);
  });

  it("sem cartão no filtro, nenhum credit_card_id", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const { result } = renderWithFilters({ ...BASE_STATE, cardSel: [] });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(listTransactions.mock.calls[0][0]).not.toHaveProperty("credit_card_id");
  });

  it("404 CREDIT_CARD_NOT_FOUND aparece como errorCode para a página reagir", async () => {
    listTransactions.mockRejectedValue(Object.assign(new Error("404"), {
      isAxiosError: true, response: { status: 404, data: { error: "CREDIT_CARD_NOT_FOUND", type: "not_found" } },
    }));
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const { result } = renderWithFilters({ ...BASE_STATE, cardSel: ["9"] });
    await waitFor(() => expect(result.current.errorCode).toBe("CREDIT_CARD_NOT_FOUND"));
  });
});

describe("#293 — a consulta é identificada pelo CONTEÚDO dos filtros", () => {
  it("objeto de filtros novo com o mesmo conteúdo: nenhuma busca nova", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const make = () => filtersToLegacyParams({ ...BASE_STATE, cardSel: ["5"] }, { limit: 10 });
    const { result, rerender } = renderHook(
      ({ filters }) => useTransactionsData({ organizationId: ORG, enabled: true, filters }),
      { initialProps: { filters: make() } },
    );
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    rerender({ filters: make() });
    rerender({ filters: { ...make() } });
    await new Promise((r) => setTimeout(r, 30));
    expect(listTransactions).toHaveBeenCalledTimes(1);
    expect(getTransactionsSummary).toHaveBeenCalledTimes(1);
  });

  it("recarga explícita com o mesmo conteúdo: busca de novo", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);
    const { result } = renderWithFilters({ ...BASE_STATE });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    result.current.reload();
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(2));
    expect(getTransactionsSummary).toHaveBeenCalledTimes(2);
  });
});


describe("moeda dos totais (fincla-api#520 D1, G3-1-01)", () => {
  it("Transações pede o resumo com slice_currency=true, como o exportador calcula o arquivo", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const { result } = renderWithFilters({ ...BASE_STATE, settlement: "a-pagar" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getTransactionsSummary).toHaveBeenCalledTimes(1);
    expect(getTransactionsSummary.mock.calls[0][0]).toMatchObject({ slice_currency: true, settled: false });
    // A listagem não tem regra de moeda: o parâmetro é só do resumo.
    expect(listTransactions.mock.calls[0][0]).not.toHaveProperty("slice_currency");
  });
});
