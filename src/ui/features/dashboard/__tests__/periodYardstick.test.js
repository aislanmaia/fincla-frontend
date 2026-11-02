import { describe, it, expect } from "vitest";
import { linearProjection, periodYardstick } from "../periodYardstick.js";

const nov = { rangeStartYmd: "2026-11-01", rangeEndYmd: "2026-11-30", periodContainsToday: true };

describe("periodYardstick", () => {
  it("mês corrente sem receita: a base é a renda declarada", () => {
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

  it("período que não contém hoje é julgado só pelo que aconteceu", () => {
    const oct = { rangeStartYmd: "2026-10-01", rangeEndYmd: "2026-10-31", periodContainsToday: false };
    expect(periodYardstick({ income: 0, expenses: 3000, declaredMonthlyIncome: 9200, ...oct }))
      .toEqual({ envelope: 3000, base: 0, basis: "income" });
  });

  it("período de vários meses nunca troca receita real pela declarada", () => {
    const ytd = { rangeStartYmd: "2026-01-01", rangeEndYmd: "2026-11-30", periodContainsToday: true };
    expect(periodYardstick({ income: 80000, expenses: 79000, declaredMonthlyIncome: 9200, ...ytd }).basis).toBe("income");
  });

  it("sem renda declarada, é a régua antiga max(receita, despesa)", () => {
    expect(periodYardstick({ income: 0, expenses: 157.6, declaredMonthlyIncome: null, ...nov }).envelope).toBe(157.6);
  });

  it("recorte do mês corrente usa a renda proporcional aos dias", () => {
    const week = { rangeStartYmd: "2026-11-01", rangeEndYmd: "2026-11-07", periodContainsToday: true };
    expect(periodYardstick({ income: 0, expenses: 50, declaredMonthlyIncome: 9000, ...week }).base).toBeCloseTo(2100);
  });

  it("fevereiro inteiro vale a renda inteira", () => {
    const feb = { rangeStartYmd: "2027-02-01", rangeEndYmd: "2027-02-28", periodContainsToday: true };
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: 9200, ...feb }).base).toBeCloseTo(9200);
  });

  it("despesa acima da base: a régua é a despesa", () => {
    expect(periodYardstick({ income: 0, expenses: 12000, declaredMonthlyIncome: 9200, ...nov }).envelope).toBe(12000);
  });

  it("renda declarada como string numérica ou dinheiro canônico também vale", () => {
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: "9200.00", ...nov }).base).toBe(9200);
    expect(periodYardstick({ income: 0, expenses: 10, declaredMonthlyIncome: { amount: "9200.00", currency: "BRL" }, ...nov }).base).toBe(9200);
  });

  it("totais nulos (multi-moeda sem cotação): a renda declarada não entra", () => {
    expect(periodYardstick({ income: null, expenses: null, declaredMonthlyIncome: 9200, ...nov }).basis).toBe("income");
  });
});

describe("linearProjection", () => {
  it("chega ao envelope no último ponto", () => {
    expect(linearProjection(9200, 30, 29)).toBe(9200);
    expect(linearProjection(9200, 30, 0)).toBe(307);
  });
});
