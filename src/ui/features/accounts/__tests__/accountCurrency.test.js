import { describe, expect, it } from "vitest";

import { CURRENCIES, formatDay, formatMoney } from "../accountMeta.js";

/**
 * Antes, TODO saldo era formatado como real. Uma conta em dólar aparecia como
 * "R$ 250,50": o número certo com a unidade errada, que é pior que número
 * nenhum porque parece correto e ninguém confere.
 */
describe("formatMoney", () => {
  it("formata na moeda do valor, não sempre em real", () => {
    expect(formatMoney(250.5, "BRL")).toContain("250,50");
    expect(formatMoney(250.5, "BRL")).toContain("R$");

    const usd = formatMoney(250.5, "USD");
    expect(usd).toContain("250,50");
    expect(usd).not.toContain("R$");

    const eur = formatMoney(250.5, "EUR");
    expect(eur).toContain("250,50");
    expect(eur).not.toContain("R$");
  });

  it("mantém a locale do usuário — vírgula decimal mesmo em dólar", () => {
    // O usuário é brasileiro mesmo quando o dinheiro não é: "250.50" o faria ler
    // duzentos e cinquenta mil.
    expect(formatMoney(1234.56, "USD")).toContain("1.234,56");
  });

  it("devolve null para ausência, nunca um zero de consolo", () => {
    // Zero inventado num saldo afirma que a pessoa não tem dinheiro. O total vem
    // `null` quando o backend não conseguiu consolidar (fincla-api#138).
    for (const ausente of [null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect([ausente, formatMoney(ausente, "BRL")]).toEqual([ausente, null]);
    }
  });

  it("zero de verdade continua sendo zero", () => {
    expect(formatMoney(0, "BRL")).toContain("0,00");
    expect(formatMoney("0.00", "USD")).toContain("0,00");
  });

  it("sem moeda declarada, assume real — o padrão do produto", () => {
    expect(formatMoney(10)).toContain("R$");
  });
});

describe("formatDay", () => {
  it("mostra dia e mês da cotação", () => {
    expect(formatDay("2026-09-03")).toBe("03/09");
  });

  it("não anda um dia para trás em fuso negativo", () => {
    // `new Date("2026-09-03")` é meia-noite UTC; em São Paulo isso é 21h do dia 2,
    // e a taxa de ontem pareceria de anteontem.
    expect(formatDay("2026-09-01")).toBe("01/09");
    expect(formatDay("2026-01-01")).toBe("01/01");
  });

  it("entrada inválida vira string vazia, não 'NaN/NaN'", () => {
    for (const ruim of [null, undefined, "", "ontem", 42]) {
      expect(formatDay(ruim)).toBe("");
    }
  });
});

describe("CURRENCIES", () => {
  it("oferece exatamente o que o registro do backend tem ativo hoje", () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(["BRL", "USD", "EUR"]);
  });

  it("cada moeda tem símbolo e rótulo para o seletor", () => {
    for (const c of CURRENCIES) {
      expect(c.symbol, c.code).toBeTruthy();
      expect(c.label, c.code).toBeTruthy();
    }
  });
});
