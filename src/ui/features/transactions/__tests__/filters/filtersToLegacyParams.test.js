import { describe, expect, it } from "vitest";
import {
  filtersToLegacyParams,
  mapCatsToLegacy,
  mapMethodToLegacy,
  mapSortToLegacy,
  mapTypeToLegacy,
  mapValueRangeToLegacy,
  matchesValueRange,
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

describe("mapMethodToLegacy", () => {
  it("normaliza forma de pagamento para o contrato da API", () => {
    expect(mapMethodToLegacy([])).toBe("todos");
    expect(mapMethodToLegacy(["credito"])).toBe("credit_card");
    expect(mapMethodToLegacy(["dinheiro"])).toBe("cash");
    expect(mapMethodToLegacy(["pix", "credito"])).toBe("todos");
  });
});

describe("mapValueRangeToLegacy", () => {
  it("converte strings BRL em números", () => {
    expect(mapValueRangeToLegacy("100,00", "500,00")).toEqual({
      valueMin: 100,
      valueMax: 500,
    });
  });

  it("ignora campos vazios ou inválidos", () => {
    expect(mapValueRangeToLegacy("", "")).toEqual({});
    expect(mapValueRangeToLegacy("200,00", "")).toEqual({ valueMin: 200 });
    expect(mapValueRangeToLegacy("", "abc")).toEqual({});
  });
});

describe("matchesValueRange", () => {
  it("aceita qualquer valor quando a faixa está vazia", () => {
    expect(matchesValueRange(150, "", "")).toBe(true);
  });

  it("filtra por mínimo, máximo ou ambos", () => {
    expect(matchesValueRange(50, "100", "")).toBe(false);
    expect(matchesValueRange(150, "100", "")).toBe(true);
    expect(matchesValueRange(600, "", "500")).toBe(false);
    expect(matchesValueRange(400, "100,00", "500,00")).toBe(true);
  });
});

describe("filtersToLegacyParams", () => {
  const base = {
    type: "todos",
    method: [],
    cats: [],
    period: "mes",
    customFrom: "",
    customTo: "",
    sort: [{ field: "date", dir: "desc" }],
  };

  it("inclui faixa de valor quando informada", () => {
    expect(
      filtersToLegacyParams(
        { ...base, valueMin: "50,00", valueMax: "200,00" },
        { limit: 30 },
      ),
    ).toEqual(
      expect.objectContaining({
        valueMin: 50,
        valueMax: 200,
      }),
    );
  });

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

  it("inclui forma de pagamento mapeada para a API", () => {
    const out = filtersToLegacyParams({ ...base, method: ["credito"] }, { limit: 30 });
    expect(out.filterMethod).toBe("credit_card");
  });
});
