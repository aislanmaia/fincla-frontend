import { describe, expect, it } from "vitest";
import {
  filtersToLegacyParams,
  mapCatsToLegacy,
  mapSortToLegacy,
  mapTypeToLegacy,
} from "../../filters/filtersToLegacyParams.js";

describe("mapCatsToLegacy", () => {
  it("retorna 'todas' quando a seleção está vazia", () => {
    expect(mapCatsToLegacy([])).toBe("todas");
    expect(mapCatsToLegacy(null)).toBe("todas");
    expect(mapCatsToLegacy(undefined)).toBe("todas");
  });

  it("retorna o id único quando há exatamente 1 categoria selecionada", () => {
    expect(mapCatsToLegacy(["alim"])).toBe("alim");
    expect(mapCatsToLegacy(["alim"], 5)).toBe("alim");
  });

  it("retorna a primeira quando há múltiplas mas não todas (limitação do contrato)", () => {
    expect(mapCatsToLegacy(["alim", "trans"], 5)).toBe("alim");
  });

  it("retorna 'todas' quando TODAS as categorias estão selecionadas (botão 'Todas' na UI)", () => {
    expect(mapCatsToLegacy(["alim", "trans", "casa"], 3)).toBe("todas");
    expect(mapCatsToLegacy(["a", "b", "c", "d", "e"], 5)).toBe("todas");
  });

  it("trata cats.length > totalCategories como 'todas' (defensivo)", () => {
    expect(mapCatsToLegacy(["a", "b", "c"], 2)).toBe("todas");
  });

  it("ignora totalCategories quando 0 ou ausente (back-compat: usa a primeira)", () => {
    expect(mapCatsToLegacy(["alim", "trans"])).toBe("alim");
    expect(mapCatsToLegacy(["alim", "trans"], 0)).toBe("alim");
  });
});

describe("mapSortToLegacy", () => {
  it("vazio ou inválido → 'date-desc'", () => {
    expect(mapSortToLegacy([])).toBe("date-desc");
    expect(mapSortToLegacy(null)).toBe("date-desc");
  });

  it("mapeia o primeiro critério", () => {
    expect(mapSortToLegacy([{ field: "val", dir: "asc" }])).toBe("val-asc");
    expect(mapSortToLegacy([{ field: "desc", dir: "desc" }])).toBe("name-desc");
  });

  it("campo sem equivalente cai no default", () => {
    expect(mapSortToLegacy([{ field: "tipo", dir: "asc" }])).toBe("date-desc");
  });
});

describe("mapTypeToLegacy", () => {
  it("normaliza valores", () => {
    expect(mapTypeToLegacy("receita")).toBe("receita");
    expect(mapTypeToLegacy("despesa")).toBe("despesa");
    expect(mapTypeToLegacy("todos")).toBe("todos");
    expect(mapTypeToLegacy(undefined)).toBe("todos");
  });
});

describe("filtersToLegacyParams", () => {
  const base = {
    type: "todos",
    cats: [],
    period: "mes",
    customFrom: "",
    customTo: "",
    sort: [{ field: "date", dir: "desc" }],
  };

  it("monta o objeto completo com defaults sensatos", () => {
    expect(
      filtersToLegacyParams(base, { limit: 30, debouncedSearch: "mercado" }),
    ).toEqual({
      search: "mercado",
      filterType: "todos",
      filterCat: "todas",
      filterMethod: "todos",
      period: "mes",
      customFrom: "",
      customTo: "",
      sortBy: "date-desc",
      limit: 30,
    });
  });

  it("usa totalCategories para mapear 'Todas selecionadas' → 'todas'", () => {
    const all = filtersToLegacyParams(
      { ...base, cats: ["a", "b", "c"] },
      { limit: 30, totalCategories: 3 },
    );
    expect(all.filterCat).toBe("todas");

    const partial = filtersToLegacyParams(
      { ...base, cats: ["a", "b"] },
      { limit: 30, totalCategories: 3 },
    );
    expect(partial.filterCat).toBe("a");
  });
});
