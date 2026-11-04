import { describe, expect, it } from "vitest";

import { convertAmountExact } from "../convertAmount.js";

describe("convertAmountExact — HALF_UP em 2 casas, igual ao Quotation.convert", () => {
  it("arredonda a metade para cima (float e banker's errariam)", () => {
    // 10,10 × 0,25 = 2,525 → 2,53
    expect(convertAmountExact("10.10", "0.25")).toBe("2.53");
    // 1,005 × 1 = 1,005 → 1,01 (float: 1.005.toFixed(2) === "1.00")
    expect(convertAmountExact("1.005", "1")).toBe("1.01");
  });
  it("converte valores comuns", () => {
    expect(convertAmountExact("287.15", "0.1825")).toBe("52.40");
    expect(convertAmountExact("100", "6.00")).toBe("600.00");
    expect(convertAmountExact(100, "0.0068")).toBe("0.68");
  });
  it("entrada inválida → null", () => {
    expect(convertAmountExact("abc", "1")).toBeNull();
  });
});
