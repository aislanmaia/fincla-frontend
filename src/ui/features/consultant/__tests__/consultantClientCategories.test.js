import { describe, expect, it } from "vitest";

import { selectClientCategories, toCategoryRow } from "../consultantClientCategories.js";

/** Ponto de `GET /analytics/by-category` (`CategoryDataPoint`). */
function cat(over = {}) {
  return { tag_id: "t1", tag_name: "Alimentação", tag_icon_key: "food", total: 800, percentage: 40, transaction_count: 12, tag_color: "#059669", ...over };
}

describe("toCategoryRow", () => {
  it("projeta os campos reais do endpoint", () => {
    const r = toCategoryRow(cat());
    expect(r).toMatchObject({ id: "t1", label: "Alimentação", color: "#059669", iconKey: "food", pct: 40, value: 800, count: 12 });
  });
  it("aplica fallbacks (sem cor/label/id)", () => {
    const r = toCategoryRow({ total: 100, percentage: 5, transaction_count: 1 }, 1);
    expect(r.label).toBe("Sem categoria");
    expect(r.color).toBe("#2563EB"); // paleta de fallback na posição 1
    expect(r.id).toBe("1");
  });
  it("arredonda percentage e coage total/count ausentes a 0", () => {
    const r = toCategoryRow({ tag_name: "X", percentage: 33.7 });
    expect(r.pct).toBe(34);
    expect(r.value).toBe(0);
    expect(r.count).toBe(0);
  });
});

describe("selectClientCategories", () => {
  it("ordena do maior gasto p/ o menor e calcula max/total", () => {
    const { rows, max, total } = selectClientCategories([
      cat({ tag_id: "a", tag_name: "A", total: 300 }),
      cat({ tag_id: "b", tag_name: "B", total: 900 }),
      cat({ tag_id: "c", tag_name: "C", total: 600 }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["B", "C", "A"]);
    expect(max).toBe(900);
    expect(total).toBe(1800);
  });
  it("tolera entrada não-array", () => {
    expect(selectClientCategories(null)).toEqual({ rows: [], max: 0, total: 0 });
  });
});
