import { describe, it, expect } from "vitest";
import { periodYardstick } from "../periodYardstick.js";
import { buildRhythmChart } from "../useDashboardData.js";

const today = new Date(2026, 10, 2); // 02/11/2026
const nov = { rangeStartYmd: "2026-11-01", rangeEndYmd: "2026-11-30", today };

describe("periodYardstick", () => {
  it("período corrente sem receita: a base é a renda declarada", () => {
    expect(periodYardstick({ income: 0, expenses: 157.6, declaredMonthlyIncome: 9200, ...nov }))
      .toEqual({ envelope: 9200, base: 9200, basis: "declared" });
  });

  it("receita pequena não cria degrau: continua a renda declarada", () => {
    expect(periodYardstick({ income: 10, expenses: 157.6, declaredMonthlyIncome: 9200, ...nov }).envelope).toBe(9200);
  });

  it("receita acima da declarada: vale a receita", () => {
    expect(periodYardstick({ income: 9500, expenses: 100, declaredMonthlyIncome: 9200, ...nov }))
      .toEqual({ envelope: 9500, base: 9500, basis: "income" });
  });

  it("mês passado é julgado só pelo que aconteceu", () => {
    const oct = { rangeStartYmd: "2026-10-01", rangeEndYmd: "2026-10-31", today };
    expect(periodYardstick({ income: 0, expenses: 3000, declaredMonthlyIncome: 9200, ...oct }))
      .toEqual({ envelope: 3000, base: 0, basis: "income" });
  });

  it("sem renda declarada, é a régua antiga max(receita, despesa)", () => {
    expect(periodYardstick({ income: 0, expenses: 157.6, declaredMonthlyIncome: null, ...nov }).envelope).toBe(157.6);
  });

  it("período que não é um mês usa a renda proporcional aos dias", () => {
    const week = { rangeStartYmd: "2026-11-01", rangeEndYmd: "2026-11-07", today };
    expect(periodYardstick({ income: 0, expenses: 50, declaredMonthlyIncome: 9000, ...week }).base).toBeCloseTo(2100);
  });

  it("despesa acima da base: a régua é a despesa", () => {
    expect(periodYardstick({ income: 0, expenses: 12000, declaredMonthlyIncome: 9200, ...nov }).envelope).toBe(12000);
  });
});

describe("buildRhythmChart usa a mesma régua", () => {
  it("a projeção do gráfico termina na renda declarada quando ainda não houve receita", () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dim = new Date(y, m, 0).getDate();
    const start = `${y}-${pad(m)}-01`;
    const end = `${y}-${pad(m)}-${pad(dim)}`;
    const summary = { total_income: 0, total_expenses: 157.6 };
    const chart = buildRhythmChart([], summary, start, end, 9200);
    expect(chart.series.at(-1).proj).toBe(9200);
    const old = buildRhythmChart([], summary, start, end, null);
    expect(old.series.at(-1).proj).toBe(158);
  });
});
