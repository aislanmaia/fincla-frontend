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
describe("useTransactionsFilterState — Categoria e Tags convivem", () => {
  // A exclusão mútua (achado 2) existia porque as duas facets disputavam o
  // único `tag_id` que o backend aceitava: deixar as duas acesas mostrava um
  // chip filtrando nada. Agora `category` e `tag_id` são repetíveis e se
  // combinam por AND, então marcar as duas pede a interseção — e é isso que a
  // tela precisa deixar aceso.
  it("selecionar uma categoria PRESERVA a tag já marcada", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setTags(["ifood"]));
    act(() => result.current.setCats(["cat-alimentacao"]));

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    expect(result.current.tags).toEqual(["ifood"]);
  });

  it("selecionar uma tag PRESERVA a categoria já marcada", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setCats(["cat-alimentacao"]));
    act(() => result.current.setTags(["ifood"]));

    expect(result.current.tags).toEqual(["ifood"]);
    expect(result.current.cats).toEqual(["cat-alimentacao"]);
  });

  it("limpar a seleção (array vazio) NÃO mexe na outra facet", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() => result.current.setCats(["cat-alimentacao"]));
    act(() => result.current.setTags([]));

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
  });

  it("um snapshot com as duas facets preenchidas mantém as duas", () => {
    const { result } = renderHook(() => useTransactionsFilterState());

    act(() =>
      result.current.applySnapshot({
        cats: ["cat-alimentacao"],
        tags: ["ifood"],
        sort: [{ field: "date", dir: "desc" }],
      }),
    );

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    expect(result.current.tags).toEqual(["ifood"]);
  });

  it("um estado inicial com as duas facets preenchidas mantém as duas", () => {
    const { result } = renderHook(() =>
      useTransactionsFilterState({
        initial: { cats: ["cat-alimentacao"], tags: ["ifood"] },
      }),
    );

    expect(result.current.cats).toEqual(["cat-alimentacao"]);
    expect(result.current.tags).toEqual(["ifood"]);
  });
});

describe("useTransactionsFilterState — facet Tags no buildFacets", () => {
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

  it("com várias tags mostra a contagem E o modo de combinação", () => {
    const { result } = renderHook(() => useTransactionsFilterState());
    act(() => result.current.setTags(["ifood", "viagem"]));
    const tagFacet = result.current.buildFacets().find((f) => f.key === "tag");
    // O modo entra no rótulo porque "2 tags" descreve dois recortes bem
    // diferentes: qualquer uma delas (OU) ou as duas juntas (E). Sem ele o
    // card mente para metade dos casos.
    expect(tagFacet.value).toBe("2 tags (OU)");
    expect(tagFacet.multi).toBe(2);
  });

  it("no modo E o rótulo acompanha", () => {
    const { result } = renderHook(() => useTransactionsFilterState());
    act(() => {
      result.current.setTags(["ifood", "viagem"]);
      result.current.setTagMode("all");
    });
    const tagFacet = result.current.buildFacets().find((f) => f.key === "tag");
    expect(tagFacet.value).toBe("2 tags (E)");
  });

  it("uma tag só não carrega modo — não há o que combinar", () => {
    const { result } = renderHook(() => useTransactionsFilterState());
    act(() => result.current.setTags(["ifood"]));
    const tagFacet = result.current.buildFacets().find((f) => f.key === "tag");
    expect(tagFacet.value).not.toMatch(/\((OU|E)\)/);
  });
});
