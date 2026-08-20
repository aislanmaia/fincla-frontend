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
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

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
