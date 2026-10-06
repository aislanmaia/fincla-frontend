import { describe, expect, it } from "vitest";

import { historyPoints, categoryTrend } from "../hubCharts.js";

const invoices = [
  { key: "2026-08", year: 2026, month: 8, status: "paid", total: 100 },
  { key: "2026-10", year: 2026, month: 10, status: "open", total: 70 },
  { key: "2026-11", year: 2026, month: 11, status: "forecast", total: 40 },
];

describe("Hub charts", () => {
  it("trims months before the first invoice, while preserving gaps and real zero forecasts", () => {
    const points = historyPoints(invoices, "2026-10", false);
    expect(points.map((p) => p.key)).toEqual([
      "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01",
    ]);
    expect(points[1].total).toBeNull();
    expect(points[2].total).toBe(70);
    expect(historyPoints(invoices, "2026-10", true).map((p) => p.key)).toEqual([
      "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01",
    ]);
  });

  it("uses only actual category values and preserves net refunds", () => {
    const data = categoryTrend({ monthly_data: [
      { year: 2026, month: 8, category_breakdown: { Food: 70, Travel: -10 } },
      { year: 2026, month: 10, category_breakdown: { Food: 20 } },
    ] }, "2026-10");
    expect(data.categories).toEqual(["Food", "Travel"]);
    expect(data.months.find((m) => m.key === "2026-09").available).toBe(false);
    expect(data.months.find((m) => m.key === "2026-08").values).toEqual({ Food: 70, Travel: -10 });
    expect(data.months.map((m) => m.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("does not claim a trend when the optional series is unavailable", () => {
    expect(categoryTrend({ monthly_data: [{ year: 2026, month: 10 }] }, "2026-10")).toBeNull();
  });
});
