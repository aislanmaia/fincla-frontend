import { describe, expect, it } from "vitest";

import { parseBRL } from "../../features/accounts/accountMeta.js";
import {
  currencyUsesDotDecimal,
  moneyInputStatus,
  parseMoneyInputFor,
  readDotDecimalMoney,
  reformatMoneyInputOnBlur,
} from "../moneyInput.js";

describe("currencyUsesDotDecimal (derivado do Intl, não de uma lista de moedas)", () => {
  it.each([
    ["USD", true], ["GBP", true], ["JPY", true], ["CAD", true], ["usd", true],
    ["BRL", false], ["EUR", false], ["ARS", false], ["XAF", false],
    [null, false], ["", false], ["US", false],
  ])("%s → %s", (code, expected) => {
    expect(currencyUsesDotDecimal(code)).toBe(expected);
  });
});

describe("moeda de ponto decimal (USD): o inequívoco primeiro", () => {
  it.each([
    ["1,234.56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234,56", 1234.56], // hábito brasileiro continua valendo
    ["52,40", 52.4],
    ["52,4", 52.4],
    ["52.4", 52.4],
    ["52.40", 52.4],
    ["1,500", 1500],
    ["1.500", 1500],
    ["1,234,567.89", 1234567.89],
    ["1.234.567", 1234567],
    ["1500", 1500],
    [" 2 500 ", 2500],
    ["-1,500", -1500],
    [".5", 0.5],
  ])("%s → %s", (text, value) => {
    expect(readDotDecimalMoney(text)).toEqual({ status: "ok", value });
    expect(parseMoneyInputFor(text, "USD")).toBe(value);
  });

  it.each([
    "abc", "1,2,3", "1234,567", "1,23.4", "52.", "1,234.567", "1.234.56,7", "1,,500", "US$ 10", "1.2.3,45", "--1",
  ])("%s → inválido (null), nunca um número errado", (text) => {
    expect(readDotDecimalMoney(text).status).toBe("invalid");
    expect(parseMoneyInputFor(text, "USD")).toBeNull();
  });

  it("vazio é vazio, não zero", () => {
    expect(readDotDecimalMoney("  ")).toEqual({ status: "empty", value: null });
    expect(parseMoneyInputFor("", "USD")).toBeNull();
  });
});

describe("moeda de vírgula decimal (BRL, EUR): o parser de hoje, sem mudança", () => {
  it.each(["BRL", "EUR", null])("%s usa exatamente o parser legado", (currency) => {
    for (const text of ["1.500", "1,5", "1.234,56", "1234.56", "1,500", "abc", "", "R$ 10,00"]) {
      expect(parseMoneyInputFor(text, currency)).toBe(parseBRL(text));
    }
  });
  it("o parser legado do campo é respeitado (ex.: o do onboarding)", () => {
    const legacy = (t) => `legacy:${t}`;
    expect(parseMoneyInputFor("1,5", "BRL", legacy)).toBe("legacy:1,5");
    expect(parseMoneyInputFor("1,500", "USD", legacy)).toBe(1500);
  });
});

describe("moneyInputStatus / reformatMoneyInputOnBlur", () => {
  it("status por moeda", () => {
    expect(moneyInputStatus("", "USD")).toBe("empty");
    expect(moneyInputStatus("1,234.56", "USD")).toBe("ok");
    expect(moneyInputStatus("1234,567", "USD")).toBe("invalid");
    expect(moneyInputStatus("1234,567", "BRL")).toBe("ok");
    expect(moneyInputStatus("abc", "BRL")).toBe("invalid");
  });
  it("ao sair do campo, o número lido aparece escrito como o app mostra dinheiro", () => {
    expect(reformatMoneyInputOnBlur("1,500", "USD")).toBe("1.500,00");
    expect(reformatMoneyInputOnBlur("1,234.5", "USD")).toBe("1.234,50");
    expect(reformatMoneyInputOnBlur("52.4", "USD")).toBe("52,40");
    expect(reformatMoneyInputOnBlur("1234,567", "USD")).toBe("1234,567");
    expect(reformatMoneyInputOnBlur("1.500", "BRL")).toBe("1.500");
    // Reler o texto reformatado dá o mesmo número.
    expect(parseMoneyInputFor(reformatMoneyInputOnBlur("1,500", "USD"), "USD")).toBe(1500);
  });
});
