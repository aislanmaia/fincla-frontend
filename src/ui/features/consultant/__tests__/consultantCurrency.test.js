import { describe, expect, it } from "vitest";

import { fmtTotals, portfolioCurrency, sumByCurrency, trustedPortfolioLabel } from "../consultantCurrency.js";
import { fmtMoney, fmtMoney0 } from "../consultantFormat.js";
import { summarizeTransactionsByCurrency } from "../consultantClientTransactions.js";

/**
 * #314 — em que moeda escrever um número da área do consultor. Ver o cabeçalho de
 * `consultantCurrency.js`: valor de cliente na moeda dele; agregado CONVERTIDO na
 * moeda que veio com ele; agregado só ROTULADO só quando a carteira inteira está
 * no rótulo.
 */
const usd = { currency: "USD" };
const brl = { currency: "BRL" };

describe("trustedPortfolioLabel", () => {
  it("confia no rótulo quando todo cliente está nele", () => {
    expect(trustedPortfolioLabel("USD", [usd, usd])).toBe("USD");
  });

  it("carteira mista: a soma não convertida não tem unidade", () => {
    expect(trustedPortfolioLabel("BRL", [brl, usd])).toBeNull();
  });

  it("clientes todos numa moeda, rótulo noutra (base do consultor): não confia", () => {
    // A soma está em dólar; escrevê-la em real seria a unidade errada.
    expect(trustedPortfolioLabel("BRL", [usd])).toBeNull();
  });

  it("cliente sem moeda conhecida derruba a confiança", () => {
    expect(trustedPortfolioLabel("BRL", [brl, { currency: null }])).toBeNull();
  });

  it("carteira vazia não mistura nada", () => {
    expect(trustedPortfolioLabel("BRL", [])).toBe("BRL");
  });

  it("antes de a carteira carregar, nada — nem um instante de unidade errada", () => {
    expect(trustedPortfolioLabel("BRL", [], false)).toBeNull();
  });

  it("sem rótulo, sem moeda", () => {
    expect(trustedPortfolioLabel(null, [brl])).toBeNull();
  });
});

describe("portfolioCurrency", () => {
  it("a moeda comum a todos os clientes", () => {
    expect(portfolioCurrency([usd, usd])).toBe("USD");
  });
  it("mista, vazia ou com cliente sem moeda: null", () => {
    expect(portfolioCurrency([brl, usd])).toBeNull();
    expect(portfolioCurrency([])).toBeNull();
    expect(portfolioCurrency([{ currency: null }, { currency: null }])).toBeNull();
    expect(portfolioCurrency(undefined)).toBeNull();
  });
});

describe("sumByCurrency / fmtTotals", () => {
  it("uma moeda → um valor, igual ao de sempre", () => {
    const totais = sumByCurrency([{ v: "700", c: "BRL" }, { v: 300, c: "BRL" }], (x) => x.v, (x) => x.c);
    expect(fmtTotals(totais, fmtMoney)).toBe("R$ 1.000,00");
  });

  it("várias → a quebra, em ordem de código, sem converter", () => {
    const totais = sumByCurrency([{ v: 5, c: "USD" }, { v: 10, c: "BRL" }], (x) => x.v, (x) => x.c);
    expect(fmtTotals(totais, fmtMoney0)).toBe("R$ 10 + US$ 5");
  });

  it("vazio → zero na moeda dada, ou '—' sem ela; null → '—'", () => {
    expect(fmtTotals([], fmtMoney0, "BRL")).toBe("R$ 0");
    expect(fmtTotals([], fmtMoney0)).toBe("—");
    expect(fmtTotals(null, fmtMoney0, "BRL")).toBe("—");
  });

  it("valor ausente apaga o total — nunca soma parcial", () => {
    expect(sumByCurrency([{ v: null, c: "BRL" }], (x) => x.v, (x) => x.c)).toBeNull();
    expect(sumByCurrency([{ v: "", c: "BRL" }], (x) => x.v, (x) => x.c)).toBeNull();
  });
});

describe("summarizeTransactionsByCurrency", () => {
  it("linha sem moeda conta na base do cliente", () => {
    const r = summarizeTransactionsByCurrency([{ val: 100 }, { val: -40, currency: "USD" }], "USD");
    expect(r).toEqual([{ currency: "USD", income: 100, expense: 40, result: 60 }]);
  });

  it("moedas diferentes não se somam", () => {
    const r = summarizeTransactionsByCurrency([{ val: 100, currency: "USD" }, { val: -40, currency: "BRL" }], "BRL");
    expect(r).toEqual([
      { currency: "BRL", income: 0, expense: 40, result: -40 },
      { currency: "USD", income: 100, expense: 0, result: 100 },
    ]);
  });
});
