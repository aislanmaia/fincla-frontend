import { describe, expect, it } from "vitest";
import { mapCategory } from "../useDashboardData.js";

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
