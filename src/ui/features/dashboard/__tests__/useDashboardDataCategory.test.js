import { describe, expect, it } from "vitest";
import {
  buildDashboardCategoryRows,
  mapCategory,
  mapUpcomingDebits,
  pickCategoryName,
} from "../useDashboardData.js";

// Regressão #100 (achado 4): `pickCategoryName` fazia
// `Object.values(transaction.tags).flat()[0]` — pega o primeiro tag de
// QUALQUER grupo, não só o de categoria — e passava pelo tradutor de
// CATEGORIA. Mesmo defeito que `mapUpcomingDebits` já corrigiu (abaixo)
// via `firstCategoryTagFromSeries`, aplicado aqui no segundo call site.
describe("pickCategoryName", () => {
  it("acha a tag de categoria mesmo quando o primeiro grupo do payload é 'detalhe'", () => {
    // Object.entries preserva a ordem de inserção: "detalhe" chega ANTES de
    // "categoria" no payload — pegar tags[0] cego pegaria "grocery" (a tag
    // detalhe), não a categoria.
    const name = pickCategoryName({
      category: null,
      tags: {
        detalhe: [{ id: "det-1", name: "grocery", is_default: true }],
        categoria: [{ id: "cat-1", name: "Food & Groceries", icon_key: "shopping-cart" }],
      },
    });
    expect(name).toBe("Alimentação");
  });

  it("sem tag de categoria, cai no fallback `transaction.category`", () => {
    const name = pickCategoryName({
      category: "Housing",
      tags: { detalhe: [{ id: "det-1", name: "rent", is_default: true }] },
    });
    expect(name).toBe("Moradia");
  });

  it("sem tag e sem `transaction.category`, cai em 'Sem categoria'", () => {
    expect(pickCategoryName({ category: null, tags: {} })).toBe("Sem categoria");
  });

  // Regressão #100 (rodada 3, achado 1): o achado 4 original ficou pela
  // metade — `pickCategoryTagFromApiTransaction` → `pickCategoryTag`
  // terminava em `entries.flatMap(([, tags]) => tags ?? [])[0]` quando não
  // havia grupo "categoria" nem `transaction.category`, devolvendo a
  // primeira tag de QUALQUER grupo (ex.: "detalhe") como se fosse a
  // categoria — exatamente o slug cru que o docblock novo dizia impedir.
  // Corrigido na raiz compartilhada (`pickCategoryTag` em
  // transactionsAdapter.js): sem categoria confirmada, devolve `null`.
  it("sem grupo categoria e sem `transaction.category`, NUNCA usa uma tag de outro grupo como categoria", () => {
    const name = pickCategoryName({
      category: null,
      tags: { detalhe: [{ id: "det-1", name: "grocery", is_default: true }] },
    });
    expect(name).toBe("Sem categoria");
  });

  // Regressão #100 (rodada 3, achado 2a): remontar a tag como `{name,
  // icon_key}` sem `is_default` descartava o sinal que impede o sequestro
  // de uma categoria do USUÁRIO cujo texto coincide com um nome canônico do
  // seed — "Health" virava "Saúde" por engano.
  it("NÃO traduz categoria do usuário só porque o texto coincide com um nome canônico (is_default: false)", () => {
    const name = pickCategoryName({
      category: null,
      tags: { categoria: [{ id: "cat-1", name: "Health", is_default: false }] },
    });
    expect(name).toBe("Health");
  });

  // Regressão #100 (rodada 3, achado 2b): sem `is_default`, a rede de
  // segurança do `icon_key` (categoria sem nome, só ícone, de uma linha do
  // seed legada) nunca disparava — devolvia o genérico "Categoria".
  it("categoria sem nome mas com icon_key ainda cai na rede de segurança quando is_default é true", () => {
    const name = pickCategoryName({
      category: null,
      tags: { categoria: [{ id: "cat-1", name: "", icon_key: "pill", is_default: true }] },
    });
    expect(name).toBe("Saúde");
  });

  // Regressão #100 (rodada 3, achado 2c): `??` deixava passar string vazia
  // como nome "válido" — `transaction.category` vazio virava o literal ""
  // e o tradutor devolvia o genérico "Categoria" em vez de "Sem categoria".
  it('`transaction.category` vazio ("") cai em "Sem categoria", não no genérico "Categoria"', () => {
    expect(pickCategoryName({ category: "", tags: {} })).toBe("Sem categoria");
  });
});

describe("mapCategory", () => {
  it("não inventa comparação quando o período anterior não existe", () => {
    const row = mapCategory(
      {
        tag_id: 10,
        tag_name: "alimentacao",
        tag_icon_key: "burger",
        total: 220,
        tag_color: "#EF4444",
      },
      new Map(),
    );

    expect(row.avg).toBeNull();
    expect(row.value).toBe(220);
  });

  it("usa o total do período anterior quando ele existe", () => {
    const row = mapCategory(
      {
        tag_id: 10,
        tag_name: "alimentacao",
        tag_icon_key: "burger",
        total: 220,
        tag_color: "#EF4444",
      },
      new Map([[10, 180]]),
    );

    expect(row.avg).toBe(180);
    expect(row.value).toBe(220);
  });

  it("não cai no cinza neutro quando a categoria vem sem tag_color", () => {
    const row = mapCategory(
      {
        tag_id: 11,
        tag_name: "alimentacao",
        total: 220,
      },
      new Map(),
    );

    expect(row.color).toBe("#059669");
  });
});

describe("mapUpcomingDebits", () => {
  function inHorizon(daysFromNow) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
  }

  it("traduz a tag de categoria cru do seed vinda de GET /recurring-transactions (regressão review PR #97)", () => {
    // `r.tags` tem VÁRIOS tipos de tag, não só categoria — pegar tags[0]
    // cegamente pegaria a de contexto ("trabalho") em vez da categoria.
    const rows = mapUpcomingDebits({
      series: [
        {
          id: "s1",
          type: "expense",
          is_active: true,
          description: "Aluguel",
          value: 1800,
          next_occurrence: inHorizon(3),
          tags: [
            { id: "ctx-1", name: "trabalho", tag_type: { name: "contexto" } },
            { id: "cat-housing", name: "Housing", tag_type: { name: "categoria" } },
          ],
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].cat).toBe("Moradia");
  });

  it("sem tag de categoria, cai no fallback `r.category` (nunca no literal 'Categoria')", () => {
    const rows = mapUpcomingDebits({
      series: [
        {
          id: "s2",
          type: "expense",
          is_active: true,
          description: "Internet",
          value: 120,
          category: "Assinaturas & Software",
          next_occurrence: inHorizon(1),
          tags: [{ id: "ctx-1", name: "trabalho", tag_type: { name: "contexto" } }],
        },
      ],
    });

    expect(rows[0].cat).toBe("Assinaturas & Software");
  });

  it("sem tag e sem r.category, cai em 'Recorrente'", () => {
    const rows = mapUpcomingDebits({
      series: [
        {
          id: "s3",
          type: "expense",
          is_active: true,
          description: "Sem categoria",
          value: 50,
          next_occurrence: inHorizon(1),
          tags: [],
        },
      ],
    });

    expect(rows[0].cat).toBe("Recorrente");
  });
});

describe("buildDashboardCategoryRows", () => {
  it("reaproveita o tag_id da API atual para manter o comparativo", () => {
    const rows = buildDashboardCategoryRows(
      [
        {
          type: "expense",
          category: "Food & Groceries",
          value: 220,
          tags: {},
        },
      ],
      "2026-06-01",
      "2026-06-30",
      [
        {
          tag_id: "cat-food",
          tag_name: "Food & Groceries",
          tag_icon_key: "shopping-cart",
          tag_color: "#059669",
          total: 220,
        },
      ],
      new Map([["cat-food", 180]]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        tagId: "cat-food",
        avg: 180,
        color: "#059669",
      }),
    );
  });
});
