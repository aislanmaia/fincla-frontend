import { describe, expect, it } from "vitest";
import { buildRhythmChart, rhythmTransactionsInBase } from "../useDashboardData.js";

/**
 * fincla-frontend#331: a forma da curva "real" do Ritmo de Gastos vinha da soma
 * nominal do dia — US$ 100 contavam como R$ 100. A curva é escalada para o total
 * convertido, então o fim batia e o meio mentia.
 */
const RATES = [{ base: "USD", quote: "BRL", rate: "5.0000000000", quoted_on: "2026-10-31" }];
const exp = (date, value, currency) => ({ type: "expense", date, value, value_currency: currency });
const SUMMARY = { total_expenses: 600, total_income: 1000 };

describe("rhythmTransactionsInBase", () => {
  it("uma moeda só: a lista sai como entrou (a escala já resolve a forma)", () => {
    const list = [exp("2026-10-01", 10, "USD"), exp("2026-10-02", 20, "USD")];
    expect(rhythmTransactionsInBase(list, "BRL", null)).toBe(list);
  });

  it("R$ + US$: a despesa estrangeira é convertida pela taxa do período", () => {
    const out = rhythmTransactionsInBase([exp("2026-10-01", 100, "BRL"), exp("2026-10-02", 100, "USD")], "BRL", RATES);
    expect(out.map((t) => t.value)).toEqual([100, 500]);
  });

  it("despesa sem moeda declarada é a base, não uma terceira moeda", () => {
    const list = [exp("2026-10-01", 100, undefined), exp("2026-10-02", 100, "BRL")];
    expect(rhythmTransactionsInBase(list, "BRL", null)).toBe(list);
  });

  it("R$ + US$ sem taxa (ou sem base): `null`", () => {
    const list = [exp("2026-10-01", 100, "BRL"), exp("2026-10-02", 100, "USD")];
    expect(rhythmTransactionsInBase(list, "BRL", [])).toBeNull();
    expect(rhythmTransactionsInBase(list, null, RATES)).toBeNull();
  });
});

describe("buildRhythmChart — moedas (#331)", () => {
  it("o 1º dia (R$ 100) pesa 100 de 600, não 300 como na soma nominal", () => {
    const { series } = buildRhythmChart(
      [exp("2026-10-01", 100, "BRL"), exp("2026-10-02", 100, "USD")],
      SUMMARY, "2026-10-01", "2026-10-31", "BRL", RATES,
    );
    expect(series[0].real).toBe(100);
    expect(series[1].real).toBe(600);
  });

  it("sem taxa para a moeda estrangeira, a curva não é desenhada", () => {
    const { series } = buildRhythmChart(
      [exp("2026-10-01", 100, "BRL"), exp("2026-10-02", 100, "USD")],
      SUMMARY, "2026-10-01", "2026-10-31", "BRL", [],
    );
    expect(series).toEqual([]);
  });
});
