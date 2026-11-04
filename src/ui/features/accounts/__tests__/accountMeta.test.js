import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES, accountMeta, consolidationReceipt, formatBRL, formatRateExact, parseBRL } from "../accountMeta.js";

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

describe("consolidationReceipt — taxa exata, nunca arredondada para 2 casas", () => {
  it("mostra a taxa como a API deu, com vírgula", () => {
    const receipt = consolidationReceipt({ rates: [{ base: "USD", quote: "BRL", rate: "5.4653", quoted_on: "2026-11-04" }] });
    expect(receipt).toBe("Convertido com 1 USD = R$ 5,4653 (04/11)");
  });
  it("corta zeros à direita, com mínimo de 2 casas", () => {
    expect(formatRateExact("5.46530000")).toBe("5,4653");
    expect(formatRateExact("6.00")).toBe("6,00");
    expect(formatRateExact("0.0365")).toBe("0,0365");
  });
});
