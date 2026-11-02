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

describe("fmtK como tickFormatter do recharts", () => {
  // O recharts chama tickFormatter(valor, índice). Passado direto
  // (`tickFormatter={fmtK}`), o índice caía no parâmetro da moeda e virava o
  // "símbolo": o eixo do Ritmo de Gastos mostrava 0/2k/4k/6k/8k como
  // "00 / 12.0k / 24.0k / 36.0k / 48.0k".
  it("ignora o índice numérico do tick e escreve em real", () => {
    expect([0, 2000, 4000, 6000, 8000].map((v, i) => fmtK(v, i))).toEqual([
      "R$0",
      "R$2.0k",
      "R$4.0k",
      "R$6.0k",
      "R$8.0k",
    ]);
  });

  it("continua respeitando a moeda quando ela é passada de verdade", () => {
    expect(fmtK(2000, "BRL")).toBe("R$2.0k");
    expect(fmtK(2000, "USD")).not.toBe("R$2.0k");
  });
});
