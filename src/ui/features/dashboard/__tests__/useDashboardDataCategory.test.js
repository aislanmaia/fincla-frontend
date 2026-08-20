import { describe, expect, it } from "vitest";
import { buildDashboardCategoryRows, mapCategory, mapUpcomingDebits } from "../useDashboardData.js";

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
