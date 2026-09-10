import { afterEach, describe, expect, it } from "vitest";

import { currencyOptions, formatDay, formatMoney } from "../accountMeta.js";
import {
  clearCurrencyRegistry,
  setCurrencyRegistry,
} from "../../../money/currencyRegistry.js";

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

describe("currencyOptions — o que o seletor oferece", () => {
  /**
   * Era uma lista de três objetos escrita AQUI, que precisava ser editada a cada
   * moeda nova e ficava mentindo no dia em que o backend desativasse uma. Agora
   * vem de `GET /v1/currencies` (#136), e este teste passou a medir a REGRA em vez
   * de recopiar o conteúdo.
   */
  afterEach(() => clearCurrencyRegistry());

  it("oferece o que o registro diz, e só o que está ativo", () => {
    setCurrencyRegistry([
      { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
      { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
      { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: false },
    ]);

    expect(currencyOptions().map((c) => c.code)).toEqual(["BRL", "EUR"]);
  });

  it("cada opção tem símbolo e rótulo para o seletor", () => {
    setCurrencyRegistry([
      { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
    ]);

    for (const c of currencyOptions()) {
      expect(c.symbol, c.code).toBeTruthy();
      expect(c.label, c.code).toBeTruthy();
    }
  });

  it("vazio enquanto o registro não chegou — e não uma lista chapada", () => {
    // Oferecer três moedas escritas no cliente seria voltar a decidir aqui o que
    // é decisão do backend. Quem precisa de fallback é a TELA, que conhece a
    // moeda em uso; este catálogo não inventa nenhuma.
    expect(currencyOptions()).toEqual([]);
  });
});
