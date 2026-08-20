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
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { useTransactionsData } from "../useTransactionsData.js";
import { filtersToLegacyParams } from "../filters/filtersToLegacyParams.js";
import { listTransactions, getTransactionsSummary } from "../../../../api/transactions";

vi.mock("../../../../api/transactions", () => ({
  listTransactions: vi.fn(),
  getTransactionsSummary: vi.fn(),
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

describe("fincla-frontend#78 — facet Tags chega como `tag_id` na chamada HTTP", () => {
  it("tag selecionada (id já resolvido pelo chamador) -> tag_id na chamada real", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    // Reproduz o que TransacoesPage faz: resolve o NOME da facet Tags para um id
    // (via catálogo de tags) e manda como `tagIds` — antes da correção esse
    // valor nunca era lido em lugar nenhum e a seleção morria no estado local.
    const { result } = renderWithFilters(BASE_STATE, { tagIds: [TAG_ID] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORG, tag_id: TAG_ID }),
    );
    expect(getTransactionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: TAG_ID }),
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

  it("categoria selecionada continua ganhando de tag_id (limitação: backend só aceita um)", async () => {
    listTransactions.mockResolvedValue(EMPTY_PAGE);
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const CAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { result } = renderWithFilters(
      { ...BASE_STATE, cats: [CAT_ID] },
      { tagIds: [TAG_ID] },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ tag_id: CAT_ID }),
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

// fincla-frontend#109 rodada 2, achado 3 — o scroll infinito
// (`hasMore`/`tryLoadMore` em TransacoesPage.jsx) só aumenta `filters.limit`
// pra pedir mais páginas da MESMA pergunta; a página recalcula `filters` como
// objeto NOVO a cada bump, então `query`/`summaryQuery` também trocam de
// referência — indistinguível, pela checagem referencial de `sameFilters`,
// de uma troca de verdade de organização/filtro. Uma falha ao "carregar
// mais" não pode zerar as linhas já lidas.
describe("fincla-frontend#109 rodada 2, achado 3 — paginação (limit crescente) não é 'contexto novo'", () => {
  it("falha ao aumentar `limit` (scroll infinito): preserva as linhas/hasLoaded já carregados", async () => {
    const ROW = {
      id: "tx-pagina-1",
      description: "Café página 1",
      amount: -10,
      type: "expense",
      date: "2026-08-01",
      tags: {},
    };
    listTransactions.mockResolvedValueOnce({
      data: [ROW],
      pagination: { total: 30, has_next: true },
    });
    getTransactionsSummary.mockResolvedValue(EMPTY_SUMMARY);

    const filtersPage1 = filtersToLegacyParams(BASE_STATE, { limit: 10 });
    const filtersPage2 = filtersToLegacyParams(BASE_STATE, { limit: 20 });

    const { result, rerender } = renderHook(
      ({ filters }) => useTransactionsData({ organizationId: ORG, enabled: true, filters }),
      { initialProps: { filters: filtersPage1 } },
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.transactions).toHaveLength(1);

    // "Carregar mais" (limit 10 -> 20) falha.
    listTransactions.mockRejectedValueOnce(new Error("network down"));
    rerender({ filters: filtersPage2 });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    // A implementação ANTERIOR (achado 3 da rodada 1, sem distinguir
    // paginação) trocaria a linha já lida pelo card de erro e derrubaria os
    // KPIs a zero. Paginação é a MESMA consulta, só mais páginas — conta
    // como revalidação suave.
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBe("tx-pagina-1");
  });

  it("falha ao trocar de FILTRO com `limit` também diferente: ainda reseta (não é só paginação)", async () => {
    const ROW = {
      id: "tx-filtro-limit",
      description: "Café filtro",
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

    const filtersA = filtersToLegacyParams(BASE_STATE, { limit: 10 });
    // MESMO limit que a 1ª chamada de "load more" acima usaria, mas o
    // FILTRO de verdade também mudou (type) — não pode contar como paginação.
    const filtersB = filtersToLegacyParams({ ...BASE_STATE, type: "despesa" }, { limit: 20 });

    const { result, rerender } = renderHook(
      ({ filters }) => useTransactionsData({ organizationId: ORG, enabled: true, filters }),
      { initialProps: { filters: filtersA } },
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    listTransactions.mockRejectedValueOnce(new Error("network down"));
    rerender({ filters: filtersB });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.transactions).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
  });
});

