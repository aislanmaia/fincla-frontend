// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTransactionsFilterState } from "../../filters/useTransactionsFilterState.js";

afterEach(() => {
  vi.clearAllMocks();
});

// fincla-frontend#96 — revisão adversarial da PR #96, achado 2: Categoria e
// Tags disputam o MESMO slot de filtro no backend (`tag_id`); antes desta
// correção era possível marcar as duas ao mesmo tempo e a tag ficava "acesa"
// na UI sem filtrar nada (categoria vencia por baixo do capô, em silêncio).
// Decisão tomada: IMPEDIR a combinação em vez de só avisar — a seleção de uma
// sempre limpa a outra, então o que está aceso na tela é sempre exatamente o
// que está filtrando.
describe("useTransactionsFilterState — achado 2: Categoria e Tags são mutuamente exclusivas", () => {
  it("selecionar uma categoria com uma tag já marcada limpa a tag", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setTags(["ifood"]));
    expect(result.current.tags).toEqual(["ifood"]);

    act(() => result.current.setCats(["cat-alimentacao"]));

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    // Prova direta do achado 2: com a implementação anterior (`setField`
    // isolado) o array de tags continuaria `["ifood"]` — aceso, mas ignorado
    // pela query real (categoria ganhava o slot no backend).
    expect(result.current.tags).toEqual([]);
  });

  it("selecionar uma tag com uma categoria já marcada limpa a categoria", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setCats(["cat-alimentacao"]));
    expect(result.current.cats).toEqual(["cat-alimentacao"]);

    act(() => result.current.setTags(["ifood"]));

    expect(result.current.tags).toEqual(["ifood"]);
    expect(result.current.cats).toEqual([]);
  });

  it("limpar a seleção (array vazio) NÃO mexe na outra facet", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setCats(["cat-alimentacao"]));
    act(() => result.current.setTags([]));

    // `setTags([])` é "desmarcar tag", não "marcar tag vazia" — não deve
    // limpar a categoria que estava ativa.
    expect(result.current.cats).toEqual(["cat-alimentacao"]);
  });

  it("um snapshot legado com as duas facets preenchidas (view salva antiga) sanitiza tags ao aplicar", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() =>
      result.current.applySnapshot({
        cats: ["cat-alimentacao"],
        tags: ["ifood"],
        sort: [{ field: "date", dir: "desc" }],
      }),
    );

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    expect(result.current.tags).toEqual([]);
  });

  it("um estado inicial com as duas facets preenchidas também sanitiza tags", () => {
    const { result } = renderHook(() =>
      useTransactionsFilterState({
        initial: { cats: ["cat-alimentacao"], tags: ["ifood"] },
      }),
    );

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    expect(result.current.tags).toEqual([]);
  });
});

describe("useTransactionsFilterState — facet Tags no buildFacets (single-select)", () => {
  it("sem tag selecionada mostra '—'", () => {
    const { result } = renderHook(() => useTransactionsFilterState());
    const facets = result.current.buildFacets();
    const tagFacet = facets.find((f) => f.key === "tag");
    expect(tagFacet.value).toBe("—");
    expect(tagFacet.active).toBe(false);
  });

  it("com uma tag selecionada mostra '#nome'", () => {
    const { result } = renderHook(() => useTransactionsFilterState());
    act(() => result.current.setTags(["ifood"]));
    const facets = result.current.buildFacets();
    const tagFacet = facets.find((f) => f.key === "tag");
    expect(tagFacet.value).toBe("#ifood");
    expect(tagFacet.active).toBe(true);
  });
});
