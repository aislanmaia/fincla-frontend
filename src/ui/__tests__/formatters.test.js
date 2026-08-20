import { describe, it, expect } from "vitest";
import { fmtK } from "../formatters.js";

describe("fmtK", () => {
  it("corta em 'k' com uma casa decimal a partir de 1000", () => {
    expect(fmtK(7380.166666)).toBe("R$7.4k");
    expect(fmtK(1000)).toBe("R$1.0k");
  });

  it("arredonda valores fracionários abaixo de 1000 (sem ponto decimal en-US)", () => {
    // Caso real: média de 2800/6 = 466.6666666666667 — sem Math.round vazava
    // o float bruto pt-BR afora ("R$466.6666666666667").
    expect(fmtK(2800 / 6)).toBe("R$467");
    expect(fmtK(0)).toBe("R$0");
    expect(fmtK(999.4)).toBe("R$999");
  });
});
