import { describe, it, expect } from "vitest";
import { periodYardstick } from "../periodYardstick.js";

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

describe("periodYardstick — proporção e ausência", () => {
  it("um mês civil inteiro vale a renda inteira, tenha 28 ou 31 dias", () => {
    const feb = { rangeStartYmd: "2027-02-01", rangeEndYmd: "2027-02-28", today: new Date(2027, 1, 3) };
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: 9200, ...feb }).base).toBeCloseTo(9200);
  });

  it("período longo soma mês a mês: não depende do mês em que começa", () => {
    const fromJan = { rangeStartYmd: "2027-01-01", rangeEndYmd: "2027-12-31", today: new Date(2027, 0, 10) };
    const fromFeb = { rangeStartYmd: "2027-02-01", rangeEndYmd: "2028-01-31", today: new Date(2027, 1, 10) };
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: 9200, ...fromJan }).base).toBeCloseTo(110400);
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: 9200, ...fromFeb }).base).toBeCloseTo(110400);
  });

  it("totais nulos (multi-moeda sem cotação): a renda declarada não entra", () => {
    expect(periodYardstick({ income: null, expenses: null, declaredMonthlyIncome: 9200, ...nov }).basis).toBe("income");
  });
});
