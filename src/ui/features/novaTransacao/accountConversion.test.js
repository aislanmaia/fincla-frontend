import { describe, expect, it } from "vitest";

import { convertAmountExact, formatAmountInput, inverseRateExact, parseAmountInput } from "./accountConversion.js";

describe("accountConversion", () => {
  it("converte em 2 casas com HALF_UP, igual ao Quotation.convert do backend", () => {
    expect(convertAmountExact("287.15", "0.1825")).toBe("52.40");
    // 10,10 × 0,25 = 2,525: HALF_UP dá 2,53 (float/banker's dariam 2,52).
    expect(convertAmountExact("10.10", "0.25")).toBe("2.53");
    expect(convertAmountExact("100", "5.4823")).toBe("548.23");
  });
  it("taxa inversa para exibir 'US$ 1 = R$ 5,48'", () => {
    expect(inverseRateExact("0.1825")).toBe("5.48");
  });
  it("lê e escreve o campo em pt-BR", () => {
    expect(formatAmountInput("52.40")).toBe("52,40");
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("53,1")).toBe(53.1);
    expect(parseAmountInput("")).toBeNull();
  });
});
