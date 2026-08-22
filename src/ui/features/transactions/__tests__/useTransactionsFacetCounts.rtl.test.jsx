// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/transactions", () => ({
  getTransactionsFacets: vi.fn(),
}));

import { getTransactionsFacets } from "../../../../api/transactions";
import { useTransactionsFacetCounts } from "../useTransactionsFacetCounts.js";

const ORG = "11111111-1111-4111-8111-111111111111";

const FACETS = {
  type: [
    { value: "expense", label: "Despesa", count: 12 },
    { value: "income", label: "Receita", count: 7 },
  ],
  category: null,
  tag: [{ value: "tag-1", label: "mercado", count: 5 }],
  payment_method: [{ value: "pix", label: "Pix", count: 9 }],
  settlement: { paid: 14, pending: 5 },
  recurring: { yes: 3, no: 16 },
  value_bucket: [
    { from: null, to: 49.99, count: 4 },
    { from: 50, to: 99.99, count: 0 },
  ],
  total: 19,
};

const BASE_FILTERS = { filterType: "todos", period: "mes", limit: 20 };

function setup(overrides = {}) {
  return renderHook((props) => useTransactionsFacetCounts(props), {
    initialProps: {
      organizationId: ORG,
      filters: BASE_FILTERS,
      enabled: true,
      debounceMs: 0,
      ...overrides,
    },
  });
}

describe("useTransactionsFacetCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransactionsFacets.mockResolvedValue(FACETS);
  });

  it("não busca nada enquanto o painel nunca abriu", async () => {
    setup({ enabled: false });
    await act(async () => {});
    expect(getTransactionsFacets).not.toHaveBeenCalled();
  });

  it("busca ao abrir e expõe as contagens por opção", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.counts).not.toBeNull());

    expect(result.current.total).toBe(19);
    expect(result.current.optionCount("type", "expense")).toBe(12);
    expect(result.current.optionCount("payment_method", "pix")).toBe(9);
    expect(result.current.binaryCount("settlement", "pending")).toBe(5);
    expect(result.current.binaryCount("recurring", "yes")).toBe(3);
    expect(result.current.optionCountByLabel("tag", "mercado")).toBe(5);
  });

  it("manda os MESMOS filtros da lista, menos paginação e ordenação", async () => {
    const { result } = setup({
      filters: { ...BASE_FILTERS, filterType: "despesa", sortBy: "val-desc", limit: 60 },
    });
    await waitFor(() => expect(result.current.counts).not.toBeNull());

    const sent = getTransactionsFacets.mock.calls[0][0];
    expect(sent).toMatchObject({ organization_id: ORG, type: "expense" });
    // É essa igualdade que faz `total` bater com o total da listagem. Se a
    // pergunta divergir, os números descrevem um conjunto que a tela não mostra.
    expect(sent).not.toHaveProperty("limit");
    expect(sent).not.toHaveProperty("page");
    expect(sent).not.toHaveProperty("sort_by");
  });

  it("uma opção ausente da resposta conta ZERO, não 'sem dado'", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.counts).not.toBeNull());
    // A resposta lista só o que tem linha; o que não veio existe e vale 0.
    expect(result.current.optionCount("type", "refund")).toBe(0);
  });

  it("sem resposta ainda, toda contagem é null — nunca zero", async () => {
    // Zero afirmaria "esta opção não traz nada". Antes da resposta, o certo é
    // não afirmar coisa alguma: `FacetCount` não renderiza com `null`.
    getTransactionsFacets.mockImplementation(() => new Promise(() => {}));
    const { result } = setup();
    await act(async () => {});
    expect(result.current.counts).toBeNull();
    expect(result.current.optionCount("type", "expense")).toBeNull();
    expect(result.current.binaryCount("settlement", "paid")).toBeNull();
    expect(result.current.total).toBeNull();
  });

  it("falha da API não derruba nada — só fica sem número", async () => {
    getTransactionsFacets.mockRejectedValue(new Error("500"));
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.counts).toBeNull();
    expect(result.current.optionCount("type", "expense")).toBeNull();
  });

  it("não refaz a busca quando só o `limit` da lista muda (scroll infinito)", async () => {
    // `filters` é um objeto novo a cada página carregada. Comparar por
    // referência custaria uma requisição por rolagem, para um número idêntico.
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.counts).not.toBeNull());
    expect(getTransactionsFacets).toHaveBeenCalledTimes(1);

    rerender({
      organizationId: ORG,
      filters: { ...BASE_FILTERS, limit: 40 },
      enabled: true,
      debounceMs: 0,
    });
    await act(async () => {});
    expect(getTransactionsFacets).toHaveBeenCalledTimes(1);
  });

  it("refaz a busca quando um filtro de verdade muda", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.counts).not.toBeNull());

    rerender({
      organizationId: ORG,
      filters: { ...BASE_FILTERS, filterType: "receita" },
      enabled: true,
      debounceMs: 0,
    });
    await waitFor(() => expect(getTransactionsFacets).toHaveBeenCalledTimes(2));
    expect(getTransactionsFacets.mock.calls[1][0]).toMatchObject({ type: "income" });
  });

  it("continua acompanhando os filtros depois que o painel fecha", async () => {
    // Fechar não descarta o que já foi pago: reabrir não deve piscar o número
    // de novo a cada visita.
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.counts).not.toBeNull());

    rerender({
      organizationId: ORG,
      filters: { ...BASE_FILTERS, filterType: "despesa" },
      enabled: false,
      debounceMs: 0,
    });
    await waitFor(() => expect(getTransactionsFacets).toHaveBeenCalledTimes(2));
  });

  it("sem organização não busca e zera as contagens", async () => {
    const { result } = setup({ organizationId: null });
    await act(async () => {});
    expect(getTransactionsFacets).not.toHaveBeenCalled();
    expect(result.current.counts).toBeNull();
  });
});
