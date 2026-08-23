import { describe, it, expect } from "vitest";
import {
  parseBrl,
  isBucketInRange,
  bucketEdges,
} from "../filters/facetBar/panels/ValuePanel.jsx";

/** As seis faixas do backend, fechadas nos dois lados (daí o `.99`). */
const B = [
  { from: null, to: 49.99 },
  { from: 50, to: 99.99 },
  { from: 100, to: 249.99 },
  { from: 250, to: 499.99 },
  { from: 500, to: 999.99 },
  { from: 1000, to: null },
];

describe("parseBrl", () => {
  it("lê o formato dos campos desta tela", () => {
    expect(parseBrl("1234,50")).toBe(1234.5);
    expect(parseBrl("1.234,50")).toBe(1234.5);
    expect(parseBrl("250")).toBe(250);
  });

  it("vazio e lixo viram sem limite", () => {
    expect(parseBrl("")).toBeNull();
    expect(parseBrl("   ")).toBeNull();
    expect(parseBrl(null)).toBeNull();
  });
});

describe("isBucketInRange", () => {
  it("uma faixa digitada à mão acende as barras que ela cruza", () => {
    // 30 a 800 era o caso que deixava o histograma inteiro apagado.
    const acesas = B.map((b) => isBucketInRange(b, 30, 800));
    expect(acesas).toEqual([true, true, true, true, true, false]);
  });

  it("sem mínimo acende da primeira até onde o máximo alcança", () => {
    expect(B.map((b) => isBucketInRange(b, null, 99.99))).toEqual([
      true, true, false, false, false, false,
    ]);
  });

  it("sem máximo acende dali em diante, inclusive a faixa aberta", () => {
    expect(B.map((b) => isBucketInRange(b, 500, null))).toEqual([
      false, false, false, false, true, true,
    ]);
  });

  it("uma barra clicada acende só ela", () => {
    expect(B.map((b) => isBucketInRange(b, 100, 249.99))).toEqual([
      false, false, true, false, false, false,
    ]);
  });

  it("sem faixa nenhuma, tudo cruza — quem decide apagar é o chamador", () => {
    expect(B.every((b) => isBucketInRange(b, null, null))).toBe(true);
  });
});

describe("bucketEdges", () => {
  it("marca a primeira e a última dentro da faixa", () => {
    expect(bucketEdges(B, 30, 800)).toEqual({ first: 0, last: 4 });
  });

  it("com uma barra só, primeira e última são a mesma", () => {
    expect(bucketEdges(B, 100, 249.99)).toEqual({ first: 2, last: 2 });
  });

  it("faixa que não cruza nenhuma barra não tem pontas", () => {
    expect(bucketEdges([{ from: 0, to: 10 }], 100, 200)).toEqual({ first: -1, last: -1 });
  });
});
