import { describe, it, expect } from "vitest";
import { fmtAbs, fmtK, fmtSgn } from "../formatters.js";

describe("fmtK", () => {
  it("corta em 'k' com uma casa decimal a partir de 1000", () => {
    expect(fmtK(7380.166666, "BRL")).toBe("R$7.4k");
    expect(fmtK(1000, "BRL")).toBe("R$1.0k");
  });

  it("arredonda valores fracionários abaixo de 1000 (sem ponto decimal en-US)", () => {
    // Caso real: média de 2800/6 = 466.6666666666667 — sem Math.round vazava
    // o float bruto pt-BR afora ("R$466.6666666666667").
    expect(fmtK(2800 / 6, "BRL")).toBe("R$467");
    expect(fmtK(0, "BRL")).toBe("R$0");
    expect(fmtK(999.4, "BRL")).toBe("R$999");
  });

  it("escreve na moeda passada", () => {
    expect(fmtK(2000, "USD")).toBe("US$2.0k");
  });
});

/**
 * #310 — o padrão silencioso "sem moeda, real" fazia a Visão Geral de uma organização
 * em dólar escrever "R$". Agora a moeda é obrigatória.
 */
describe("moeda obrigatória (#310)", () => {
  it("chamada sem moeda é defeito de quem chama: no teste, lança", () => {
    expect(() => fmtAbs(10)).toThrow(/moeda ausente/);
    expect(() => fmtSgn(10)).toThrow(/moeda ausente/);
    expect(() => fmtK(10)).toThrow(/moeda ausente/);
  });

  // O recharts chama tickFormatter(valor, índice). Passado direto
  // (`tickFormatter={fmtK}`), o índice cai no lugar da moeda — e antes virava real.
  it("o índice do recharts no lugar da moeda também é moeda esquecida", () => {
    expect(() => fmtK(2000, 1)).toThrow(/moeda ausente/);
  });

  it("moeda null explícita = não sabemos a moeda → travessão, nunca R$", () => {
    expect(fmtAbs(10, null)).toBe("—");
    expect(fmtSgn(10, null)).toBe("—");
    expect(fmtK(10, null)).toBe("");
  });

  it("BRL continua byte a byte (espaço comum)", () => {
    expect(fmtAbs(-1234.5, "BRL")).toBe("R$ 1.234,50");
    expect(fmtSgn(-1234.5, "BRL")).toBe("−R$ 1.234,50");
  });
});
