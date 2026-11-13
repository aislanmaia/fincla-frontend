import { describe, expect, it } from "vitest";

import { UNKNOWN_MONEY, baseMoneyFormatters } from "../useBaseCurrencyMoney.js";

describe("baseMoneyFormatters (#310)", () => {
  it("BRL sai byte a byte como os formatadores de sempre (espaço comum)", () => {
    const m = baseMoneyFormatters("BRL");
    expect(m.fmtAbs(-1234.5)).toBe("R$ 1.234,50");
    expect(m.fmtSgn(-1234.5)).toBe("−R$ 1.234,50");
    expect(m.fmtK(2000)).toBe("R$2.0k");
    expect(m.symbol).toBe("R$");
  });

  it("USD escreve US$", () => {
    const m = baseMoneyFormatters("USD");
    expect(m.fmtAbs(5092.19)).toBe("US$ 5.092,19");
    expect(m.fmtSgn(10)).toBe("+US$ 10,00");
    expect(m.fmtK(500)).toBe("US$500");
  });

  it("moeda ainda desconhecida: travessão, nunca R$", () => {
    const m = baseMoneyFormatters(null);
    expect(m.fmtAbs(10)).toBe(UNKNOWN_MONEY);
    expect(m.fmtSgn(10)).toBe(UNKNOWN_MONEY);
    expect(m.fmtK(10)).toBe("");
    expect(m.symbol).toBeNull();
  });

  it("fmtK ignora o índice que o recharts passa como 2º argumento", () => {
    expect(baseMoneyFormatters("EUR").fmtK(2000, 3)).toBe("€2.0k");
  });

  it("fmtIntl: BRL byte a byte como o Intl de sempre (U+00A0, sinal do Intl)", () => {
    const intl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
    const m = baseMoneyFormatters("BRL");
    for (const v of [0, 1234.5, -120, 7300]) expect(m.fmtIntl(v)).toBe(intl.format(v));
  });

  it("fmtIntl: USD escreve US$; ausente e moeda desconhecida viram travessão", () => {
    expect(baseMoneyFormatters("USD").fmtIntl(1234.5)).toBe("US$\u00a01.234,50");
    expect(baseMoneyFormatters("USD").fmtIntl(null)).toBe(UNKNOWN_MONEY);
    expect(baseMoneyFormatters(null).fmtIntl(10)).toBe(UNKNOWN_MONEY);
  });
});
