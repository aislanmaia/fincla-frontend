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
  it("mostra a taxa com no máximo 4 casas (HALF_UP), no mínimo 2", () => {
    expect(formatRatePtBr("0.1825")).toBe("0,1825");
    expect(formatRatePtBr("5.49140000")).toBe("5,4914");
    expect(formatRatePtBr("0.1821029")).toBe("0,1821");
    expect(formatRatePtBr("5.46535")).toBe("5,4654");
    expect(formatRatePtBr("9.99996")).toBe("10,00");
    expect(formatRatePtBr("5.5")).toBe("5,50");
    const h = conversionHeadline({ to: "BRL", quote: { rate: "0.0365", quoted_on: "2026-11-03" }, direction: { base: "JPY", quote: "BRL" } });
    expect(h).toContain(" 1 = R$ 0,0365)");
  });

  it("o par mostrado é o da direção em que a cotação foi buscada", () => {
    const toUsd = conversionHeadline({ to: "USD", quote: { rate: "5.4914", quoted_on: "2026-11-04" }, direction: { base: "USD", quote: "BRL" } });
    expect(toUsd).toBe("Esta conta é em US$. Valor convertido pela cotação de 04/11 (US$ 1 = R$ 5,4914):");
    const toBrl = conversionHeadline({ to: "BRL", quote: { rate: "5.4914", quoted_on: "2026-11-04" }, direction: { base: "USD", quote: "BRL" } });
    expect(toBrl).toBe("Esta conta é em R$. Valor convertido pela cotação de 04/11 (US$ 1 = R$ 5,4914):");
  });
});

