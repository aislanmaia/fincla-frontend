import { describe, expect, it } from "vitest";
import { buildDashboardCategoryRows, mapCategory } from "../useDashboardData.js";

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
