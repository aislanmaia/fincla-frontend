import { describe, expect, it } from "vitest";

import { selectExpenseRows, selectMovers } from "../consultantInsights.js";

describe("selectExpenseRows", () => {
  it("ordena por gasto desc, corta em N, atribui cor e calcula max", () => {
    const { rows, max } = selectExpenseRows(
      [
        { name: "Alimentação", total: 300, percentage: 30 },
        { name: "Transporte", total: 700, percentage: 70 },
      ],
    );
    expect(rows.map((r) => r.label)).toEqual(["Transporte", "Alimentação"]);
    expect(rows[0].color).toBeTruthy();
    expect(max).toBe(700);
  });
  it("tolera entrada ausente", () => {
    expect(selectExpenseRows(null)).toEqual({ rows: [], max: 0 });
  });
});

describe("selectMovers", () => {
  const clients = [
    { organization_id: "a", trend: "up" },
    { organization_id: "b", trend: "down" },
    { organization_id: "c", trend: "flat" },
    { organization_id: "d", trend: "up" },
  ];
  it("separa evoluções (up) de quedas (down)", () => {
    const { gainers, decliners } = selectMovers(clients);
    expect(gainers.map((c) => c.organization_id)).toEqual(["a", "d"]);
    expect(decliners.map((c) => c.organization_id)).toEqual(["b"]);
  });
  it("respeita o limite e tolera entrada ausente", () => {
    expect(selectMovers(clients, 1).gainers).toHaveLength(1);
    expect(selectMovers(undefined)).toEqual({ gainers: [], decliners: [] });
  });
});
