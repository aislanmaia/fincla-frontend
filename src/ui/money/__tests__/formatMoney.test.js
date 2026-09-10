/**
 * O formatador único, e a promessa que ele tem de cumprir: **nada muda para quem
 * só tem reais**.
 *
 * Este arquivo existe por causa de um detalhe que uma revisão de leitura não pega:
 * `Intl` separa símbolo e número com ESPAÇO INQUEBRÁVEL (U+00A0). Montar a string
 * à mão mudaria, invisivelmente, todo valor já desenhado no app — e um
 * `getByText("R$ 1.234,50")` escrito com espaço comum deixaria de casar sem
 * ninguém entender por quê.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  clearCurrencyRegistry,
  currencyInfo,
  currencyRegistryLoaded,
  offeredCurrencies,
  setCurrencyRegistry,
} from "../currencyRegistry.js";
import {
  formatMoney,
  formatMoneyAbs,
  formatMoneyCompact,
  formatMoneySigned,
} from "../formatMoney.js";

const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
  { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: false },
];

afterEach(() => clearCurrencyRegistry());

describe("o real continua saindo exatamente como saía", () => {
  const antigo = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  it.each([0, 1, 1234.5, 1000000, 0.01, 999999.99])(
    "%s é byte a byte o que o Intl produzia",
    (valor) => {
      setCurrencyRegistry(REGISTRO);

      expect(formatMoney(valor, "BRL")).toBe(antigo.format(valor));
    },
  );

  it("mantém o espaço INQUEBRÁVEL entre símbolo e número", () => {
    setCurrencyRegistry(REGISTRO);

    // Escapes explícitos de propósito: escrito com os caracteres literais, este
    // teste é indistinguível de um `toBe` duplicado, e o primeiro editor que
    // "arrumasse o espaçamento" o apagaria sem perceber.
    expect(formatMoney(1234.5, "BRL")).toBe("R$\u00a01.234,50");
    expect(formatMoney(1234.5, "BRL")).not.toBe("R$\u00201.234,50");
  });

  it("sai igual mesmo ANTES de o registro carregar", () => {
    expect(currencyRegistryLoaded()).toBe(false);

    expect(formatMoney(1234.5, "BRL")).toBe(antigo.format(1234.5));
  });
});

describe("a moeda vem do argumento, não de um R$ chapado", () => {
  it("escreve euro em euro", () => {
    setCurrencyRegistry(REGISTRO);

    expect(formatMoney(50, "EUR")).toBe("€ 50,00");
    expect(formatMoney(50, "EUR")).not.toContain("R$");
  });

  it("uma moeda inativa ainda é desenhável", () => {
    // Uma conta criada quando o dólar estava ativo continua em dólar; o saldo
    // dela continua sendo mostrado. Perder o símbolo aqui seria perder o valor.
    setCurrencyRegistry(REGISTRO);

    expect(formatMoney(10, "USD")).toBe("US$ 10,00");
  });

  it("o SÍMBOLO do registro vence o do Intl", () => {
    // É o que torna o registro a autoridade: se ele disser que o euro se escreve
    // "EUR ", é isso que a tela escreve — sem que ninguém edite dez arquivos.
    setCurrencyRegistry([
      { code: "EUR", name: "Euro", symbol: "€€", decimal_places: 2, is_active: true },
    ]);

    expect(formatMoney(50, "EUR")).toBe("€€ 50,00");
  });

  it("as CASAS DECIMAIS do registro vencem as do Intl", () => {
    setCurrencyRegistry([
      { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 0, is_active: true },
    ]);

    expect(formatMoney(1234.5, "BRL")).toBe("R$ 1.235");
  });

  it("um código que não é ISO 4217 não derruba a tela", () => {
    expect(formatMoney(10, "XPTO")).toContain("10,00");
  });
});

describe("ausência nunca vira zero", () => {
  it.each([null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY])(
    "%s devolve null, e não R$ 0,00",
    (valor) => {
      expect(formatMoney(valor, "BRL")).toBeNull();
      expect(formatMoneyAbs(valor, "BRL")).toBeNull();
      expect(formatMoneySigned(valor, "BRL")).toBeNull();
    },
  );

  it("zero DE VERDADE continua saindo como zero", () => {
    // A distinção que o épico inteiro existe para fazer: `null` é "não sabemos",
    // `0` é "é zero".
    expect(formatMoney(0, "BRL")).toBe("R$ 0,00");
  });
});

describe("as variações que o app usa", () => {
  it("o absoluto perde o sinal, o com-sinal o mostra com o menos matemático", () => {
    setCurrencyRegistry(REGISTRO);

    expect(formatMoneyAbs(-99.9, "BRL")).toBe("R$ 99,90");
    expect(formatMoneySigned(-99.9, "BRL")).toBe("−R$ 99,90");
    expect(formatMoneySigned(99.9, "BRL")).toBe("+R$ 99,90");
    // U+2212, não o hífen: é o formato que o app usa desde sempre.
    expect(formatMoneySigned(-1, "BRL").startsWith("−")).toBe(true);
  });

  it("o compacto corta em k acima de mil e arredonda abaixo", () => {
    setCurrencyRegistry(REGISTRO);

    expect(formatMoneyCompact(1500, "BRL")).toBe("R$1.5k");
    // Sem o arredondamento, uma média sairia "R$466.6666666666667" — ponto
    // decimal en-US solto numa UI pt-BR.
    expect(formatMoneyCompact(466.6666666666667, "BRL")).toBe("R$467");
    expect(formatMoneyCompact(1500, "EUR")).toBe("€1.5k");
  });
});

describe("o registro é quem diz o que a tela pode oferecer", () => {
  it("só as ativas, em ordem de código", () => {
    setCurrencyRegistry(REGISTRO);

    expect(offeredCurrencies().map((m) => m.code)).toEqual(["BRL", "EUR"]);
  });

  it("vazio enquanto não carregou — e não uma lista chapada", () => {
    // Oferecer três moedas escritas no cliente seria voltar a decidir aqui o que
    // é decisão do backend, e mentir no dia em que ele desativar uma.
    expect(offeredCurrencies()).toEqual([]);
  });

  it("recarregar SUBSTITUI, não acumula", () => {
    setCurrencyRegistry(REGISTRO);
    setCurrencyRegistry([
      { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
    ]);

    // Uma moeda removida do registro tem de sumir daqui também, senão ela
    // continuaria sendo oferecida até alguém recarregar a página.
    expect(offeredCurrencies().map((m) => m.code)).toEqual(["BRL"]);
  });

  it("currencyInfo cai no Intl para o que o registro não conhece", () => {
    expect(currencyInfo("EUR").symbol).toBe("€");
    expect(currencyInfo("EUR").decimalPlaces).toBe(2);
  });

  it("sem código nenhum, a moeda é o real", () => {
    expect(currencyInfo(undefined).code).toBe("BRL");
    expect(currencyInfo("  ").code).toBe("BRL");
  });
});
