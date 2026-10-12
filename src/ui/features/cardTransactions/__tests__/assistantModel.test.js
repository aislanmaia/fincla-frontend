import { describe, expect, it } from "vitest";
import { assistantInsights } from "../assistantModel.js";

const row = (id, description, value, extra = {}) => ({ id, description, value, date: "2026-10-01", type: "expense", category: "Mercado", ...extra });

describe("assistente do ledger", () => {
  it("aponta sem categoria, duplicata e a maior categoria", () => {
    const { items, alertCount } = assistantInsights([row(1, "Uber *Trip", 32.9, { category: "Transporte" }), row(2, "Uber *Trip", 32.9, { category: "Transporte" }), row(3, "Livre", 10, { category: null }), row(4, "Mercado X", 100)]);
    expect(items.map((item) => item.kind)).toEqual(["uncategorized", "duplicate", "insight"]);
    expect(items[1].rowIds).toEqual([1, 2]);
    expect(alertCount).toBe(2);
  });
  it("estorno não conta como duplicata nem como saída", () => {
    const { items } = assistantInsights([row(1, "Loja", 50, { type: "refund" }), row(2, "Loja", 50, { type: "refund" })]);
    expect(items).toEqual([]);
  });
});
