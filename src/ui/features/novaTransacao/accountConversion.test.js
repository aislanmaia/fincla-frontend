import { describe, expect, it } from "vitest";

import { conversionHeadline, formatAmountInput, formatRatePtBr, parseAmountInput } from "./accountConversion.js";

describe("accountConversion", () => {
  it("lê o campo com o parser pt-BR do app: milhar com ponto não vira decimal", () => {
    expect(parseAmountInput("1.500")).toBe(1500);
    expect(parseAmountInput("1.500,25")).toBe(1500.25);
    expect(parseAmountInput("52,40")).toBe(52.4);
    expect(parseAmountInput("")).toBeNull();
  });
  it("escreve o campo em pt-BR", () => {
    expect(formatAmountInput("52.40")).toBe("52,40");
  });
  it("mostra a taxa como a API deu, sem inverter nem zerar (JPY/KRW)", () => {
    expect(formatRatePtBr("0.1825")).toBe("0,1825");
    expect(formatRatePtBr("0.00068000")).toBe("0,00068");
    expect(formatRatePtBr("5.5")).toBe("5,50");
    const h = conversionHeadline({ from: "JPY", to: "BRL", quote: { rate: "0.0365", quoted_on: "2026-11-03" } });
    expect(h).toContain("0,0365");
    expect(h).not.toContain("0,00)");
  });
});
