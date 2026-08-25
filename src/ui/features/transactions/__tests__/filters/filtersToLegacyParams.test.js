import { describe, expect, it } from "vitest";
import {
  filtersToLegacyParams,
  mapCatsOrTagToLegacy,
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

  it("retorna a seleção quando há exatamente 1 categoria selecionada", () => {
    expect(mapCatsToLegacy(["alim"])).toEqual(["alim"]);
    expect(mapCatsToLegacy(["alim"], 5)).toEqual(["alim"]);
  });

  it("retorna a seleção INTEIRA quando há múltiplas mas não todas", () => {
    // `category` é repetível no backend e casa com qualquer um dos valores.
    expect(mapCatsToLegacy(["alim", "trans"], 5)).toEqual(["alim", "trans"]);
  });

  it("retorna 'todas' quando TODAS as categorias estão selecionadas (botão 'Todas' na UI)", () => {
    expect(mapCatsToLegacy(["alim", "trans", "casa"], 3)).toBe("todas");
    expect(mapCatsToLegacy(["a", "b", "c", "d", "e"], 5)).toBe("todas");
  });

  it("trata cats.length > totalCategories como 'todas' (defensivo)", () => {
    expect(mapCatsToLegacy(["a", "b", "c"], 2)).toBe("todas");
  });

  it("ignora totalCategories quando 0 ou ausente", () => {
    expect(mapCatsToLegacy(["alim", "trans"])).toEqual(["alim", "trans"]);
    expect(mapCatsToLegacy(["alim", "trans"], 0)).toEqual(["alim", "trans"]);
  });
});

describe("mapCatsOrTagToLegacy — categoria E tag convivem", () => {
  it("sem categoria nem tag selecionada -> 'todas' (sem filtro)", () => {
    expect(mapCatsOrTagToLegacy([], [])).toBe("todas");
    expect(mapCatsOrTagToLegacy([], undefined)).toBe("todas");
  });

  it("só tag selecionada -> manda os ids da tag", () => {
    expect(mapCatsOrTagToLegacy([], ["tag-uuid-1"])).toEqual(["tag-uuid-1"]);
  });

  it("categoria e tag juntas viram uma lista só — o backend faz AND entre elas", () => {
    expect(mapCatsOrTagToLegacy(["cat-1"], ["tag-uuid-1"])).toEqual(["cat-1", "tag-uuid-1"]);
  });

  it("manda TODAS as tags selecionadas, não só a primeira", () => {
    expect(mapCatsOrTagToLegacy([], ["tag-uuid-1", "tag-uuid-2"])).toEqual([
      "tag-uuid-1",
      "tag-uuid-2",
    ]);
  });

  it("'Todas categorias' selecionadas equivale a nenhuma, sobrando só a tag", () => {
    expect(mapCatsOrTagToLegacy(["a", "b"], ["tag-uuid-1"], 2)).toEqual(["tag-uuid-1"]);
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

  /* `tipo` e `cat` TÊM equivalente: a API aceita `sort_by=type` e
     `sort_by=category`. Enquanto não tinham token, escolhê-los renomeava o
     botão e não mexia uma linha — o defeito que responde ao clique sem fazer
     nada. O default continua existindo para campo de verdade desconhecido. */
  it("tipo e categoria têm token próprio — não caem no default", () => {
    expect(mapSortToLegacy([{ field: "tipo", dir: "asc" }])).toBe("type-asc");
    expect(mapSortToLegacy([{ field: "cat", dir: "desc" }])).toBe("cat-desc");
  });

  it("campo desconhecido cai no default", () => {
    expect(mapSortToLegacy([{ field: "lol", dir: "asc" }])).toBe("date-desc");
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
  it("mapeia cada forma da UI para o valor da API", () => {
    expect(mapMethodToLegacy(["credito"])).toEqual(["credit_card"]);
    expect(mapMethodToLegacy(["dinheiro"])).toEqual(["cash"]);
  });

  it("preserva a seleção múltipla (backend casa com qualquer uma)", () => {
    expect(mapMethodToLegacy(["pix", "credito"])).toEqual(["pix", "credit_card"]);
  });

  it("seleção vazia ou inválida vira lista vazia (sem filtro)", () => {
    expect(mapMethodToLegacy([])).toEqual([]);
    expect(mapMethodToLegacy(undefined)).toEqual([]);
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
        filterMethod: [],
      period: "mes",
      customFrom: "",
      customTo: "",
      sortBy: "date-desc",
      settlement: "todas",
      limit: 30,
    });
  });

  it("mapeia a situação (eixo de liquidação) e assume 'todas' quando ausente", () => {
    expect(
      filtersToLegacyParams({ ...base, settlement: "a-pagar" }, { limit: 30 }).settlement,
    ).toBe("a-pagar");
    expect(
      filtersToLegacyParams({ ...base, settlement: "pagas" }, { limit: 30 }).settlement,
    ).toBe("pagas");
    // Estado antigo persistido (saved view salva antes do facet existir) não pode
    // virar `undefined` e cair como `settled=undefined` na querystring.
    const legacyState = { ...base };
    delete legacyState.settlement;
    expect(filtersToLegacyParams(legacyState, { limit: 30 }).settlement).toBe("todas");
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
    expect(partial.filterCat).toEqual(["a", "b"]);
  });

  it("tagIds resolvido pelo chamador vira filterCat (tag_id no backend)", () => {
    const out = filtersToLegacyParams(
      { ...base },
      { limit: 30, tagIds: ["tag-uuid-viagem"] },
    );
    expect(out.filterCat).toEqual(["tag-uuid-viagem"]);
  });

  it("categoria e tag selecionadas ao mesmo tempo vão as duas (interseção)", () => {
    const out = filtersToLegacyParams(
      { ...base, cats: ["cat-alim"] },
      { limit: 30, tagIds: ["tag-uuid-viagem"] },
    );
    expect(out.filterCat).toEqual(["cat-alim", "tag-uuid-viagem"]);
  });

  it("sem tagIds resolvido (nome não encontrado no catálogo) não filtra por engano", () => {
    const out = filtersToLegacyParams({ ...base }, { limit: 30, tagIds: [] });
    expect(out.filterCat).toBe("todas");
  });

  it("mapeia recorrência para o param `recurring` do backend", () => {
    expect(filtersToLegacyParams({ ...base, rec: "yes" }, { limit: 30 }).recurring).toBe(true);
    expect(filtersToLegacyParams({ ...base, rec: "no" }, { limit: 30 }).recurring).toBe(false);
    expect(filtersToLegacyParams({ ...base, rec: "any" }, { limit: 30 }).recurring).toBeUndefined();
  });

  it("mapeia uma forma de pagamento para o valor da API", () => {
    const out = filtersToLegacyParams({ ...base, method: ["credito"] }, { limit: 30 });
    expect(out.filterMethod).toEqual(["credit_card"]);
  });

  it("mapeia várias formas de pagamento (casa com qualquer uma no backend)", () => {
    const out = filtersToLegacyParams(
      { ...base, method: ["pix", "credito"] },
      { limit: 30 },
    );
    expect(out.filterMethod).toEqual(["pix", "credit_card"]);
  });

  it("seleção vazia de forma de pagamento não vira filtro", () => {
    const out = filtersToLegacyParams({ ...base, method: [] }, { limit: 30 });
    expect(out.filterMethod).toEqual([]);
  });
});
