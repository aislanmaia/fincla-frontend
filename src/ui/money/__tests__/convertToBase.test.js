import { describe, expect, it } from "vitest";
import { convertToBase, expensesInBase, rateTo } from "../convertToBase.js";

const RATES = [{ base: "USD", quote: "BRL", rate: "5.0000000000", quoted_on: "2026-10-31" }];
const exp = (value, currency) => ({ type: "expense", date: "2026-10-01", value, value_currency: currency });

describe("rateTo / convertToBase", () => {
  it("usa a taxa na direção em que veio: multiplica de USD→BRL, divide de BRL→USD", () => {
    expect(rateTo("BRL", "USD", RATES)).toEqual({ rate: "5.0000000000", op: "multiply" });
    expect(convertToBase(10, "USD", "BRL", RATES)).toBe(50);
    expect(convertToBase(50, "BRL", "USD", RATES)).toBe(10);
  });

  it("mesma moeda ou moeda não declarada: o próprio valor", () => {
    expect(convertToBase(7, "BRL", "BRL", [])).toBe(7);
    expect(convertToBase(7, null, "BRL", [])).toBe(7);
  });

  it("sem taxa, sem base ou valor inválido: `null`, nunca o número cru", () => {
    expect(convertToBase(10, "EUR", "BRL", RATES)).toBeNull();
    expect(convertToBase(10, "USD", null, RATES)).toBeNull();
    expect(convertToBase("abc", "USD", "BRL", RATES)).toBeNull();
  });
});

describe("expensesInBase (#331)", () => {
  it("tudo na base: a lista sai como entrou", () => {
    const list = [exp(10, "BRL"), exp(20, undefined)];
    expect(expensesInBase(list, "BRL", null)).toBe(list);
  });

  it("base desconhecida e uma moeda declarada só (mais as sem moeda): a lista sai como entrou", () => {
    const list = [exp(10, "BRL"), exp(20, undefined)];
    expect(expensesInBase(list, null, null)).toBe(list);
  });

  it("R$ + US$: a estrangeira convertida, a de parcela sem installment_info", () => {
    const out = expensesInBase([exp(100, "BRL"), { ...exp(100, "USD"), installment_info: [{ amount: 100 }] }], "BRL", RATES);
    expect(out.map((t) => t.value)).toEqual([100, 500]);
    expect(out[1].installment_info).toBeNull();
  });

  it("mês só em US$ numa base BRL: convertido (o valor é escrito na base)", () => {
    expect(expensesInBase([exp(10, "USD")], "BRL", RATES).map((t) => t.value)).toEqual([50]);
  });

  it("estrangeira sem taxa, ou moedas misturadas sem base: `null`", () => {
    expect(expensesInBase([exp(100, "BRL"), exp(100, "EUR")], "BRL", RATES)).toBeNull();
    expect(expensesInBase([exp(100, "BRL"), exp(100, "USD")], null, RATES)).toBeNull();
  });
});
