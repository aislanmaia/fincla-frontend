import { describe, expect, it } from "vitest";

import { convertByQuote, quoteDirection } from "../quoteDirection.js";

describe("quoteDirection", () => {
  it("sempre '1 <estrangeira> = <base>', nos dois sentidos", () => {
    expect(quoteDirection({ from: "BRL", to: "USD", base: "BRL" })).toEqual({ base: "USD", quote: "BRL", op: "divide" });
    expect(quoteDirection({ from: "USD", to: "BRL", base: "BRL" })).toEqual({ base: "USD", quote: "BRL", op: "multiply" });
  });
  it("nenhum lado é a base (ou base desconhecida): '1 <origem> = <destino>'", () => {
    expect(quoteDirection({ from: "EUR", to: "USD", base: "BRL" })).toEqual({ base: "EUR", quote: "USD", op: "multiply" });
    expect(quoteDirection({ from: "BRL", to: "USD", base: null })).toEqual({ base: "BRL", quote: "USD", op: "multiply" });
  });
});

describe("convertByQuote", () => {
  it("× para a base, ÷ a partir dela, HALF_UP em 2 casas", () => {
    expect(convertByQuote("52.40", "5.4914", "multiply")).toBe("287.75");
    expect(convertByQuote("123.45", "5.4653", "divide")).toBe("22.59");
  });
  it("taxa inutilizável = sem valor (nunca taxa 1 nem 0)", () => {
    expect(convertByQuote("10.00", "0", "multiply")).toBeNull();
    expect(convertByQuote("10.00", "5.4E+0", "multiply")).toBeNull();
    expect(convertByQuote("10.00", null, "divide")).toBeNull();
  });
});
