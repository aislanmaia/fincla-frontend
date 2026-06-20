import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, accountMeta, formatBRL, parseBRL } from "../accountMeta.js";

describe("accountMeta", () => {
  it("mapeia tipos conhecidos para rótulo PT", () => {
    expect(accountMeta("checking").label).toBe("corrente");
    expect(accountMeta("savings").label).toBe("poupança");
    expect(accountMeta("investment").label).toBe("investimento");
  });

  it("usa fallback (carteira) para tipo desconhecido", () => {
    expect(accountMeta("xyz").label).toBe("carteira");
  });

  it("ACCOUNT_TYPES expõe os 4 tipos do seletor", () => {
    expect(ACCOUNT_TYPES.map((t) => t.value)).toEqual(["checking", "savings", "investment", "wallet"]);
  });
});

describe("formatBRL", () => {
  it("formata valores em BRL", () => {
    expect(formatBRL(1300)).toContain("1.300,00");
    expect(formatBRL(0)).toContain("0,00");
    expect(formatBRL(2450.5)).toContain("2.450,50");
  });
});

describe("parseBRL", () => {
  it("aceita número direto", () => {
    expect(parseBRL(1234.56)).toBe(1234.56);
  });
  it("parseia string com R$ e separadores BR", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRL("1.000.000,00")).toBe(1000000);
  });
  it("parseia inteiros e decimais simples", () => {
    expect(parseBRL("2450")).toBe(2450);
    expect(parseBRL("12,50")).toBe(12.5);
  });
  it("vazio/invalido => 0", () => {
    expect(parseBRL("")).toBe(0);
    expect(parseBRL("abc")).toBe(0);
  });
});
