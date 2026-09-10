/**
 * O carregamento do registro: uma requisição só, e falha que não derruba tela.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/currencies", () => ({ listCurrencies: vi.fn() }));

import { listCurrencies } from "../../../api/currencies";
import {
  clearCurrencyRegistry,
  currencyInfo,
  currencyRegistryLoaded,
  offeredCurrencies,
} from "../currencyRegistry.js";
import { ensureCurrencyRegistry } from "../useCurrencyRegistry.js";

const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
];

beforeEach(() => {
  clearCurrencyRegistry();
  vi.mocked(listCurrencies).mockReset();
});
afterEach(() => clearCurrencyRegistry());

describe("ensureCurrencyRegistry", () => {
  it("carrega uma vez e responde na memória depois", async () => {
    vi.mocked(listCurrencies).mockResolvedValue(REGISTRO);

    await ensureCurrencyRegistry();
    await ensureCurrencyRegistry();

    expect(listCurrencies).toHaveBeenCalledTimes(1);
    expect(currencyRegistryLoaded()).toBe(true);
    expect(offeredCurrencies().map((m) => m.code)).toEqual(["BRL", "EUR"]);
  });

  it("dez chamadas SIMULTÂNEAS viram uma requisição só", async () => {
    // Sem a promessa compartilhada, cada modal aberto dispara o seu próprio GET.
    let resolver;
    vi.mocked(listCurrencies).mockReturnValue(new Promise((r) => { resolver = r; }));

    const todas = Promise.all(Array.from({ length: 10 }, () => ensureCurrencyRegistry()));
    resolver(REGISTRO);
    await todas;

    expect(listCurrencies).toHaveBeenCalledTimes(1);
  });

  it("falha do GET não derruba a formatação — o Intl assume", async () => {
    vi.mocked(listCurrencies).mockRejectedValue(new Error("503"));

    const carregou = await ensureCurrencyRegistry();

    expect(carregou).toBe(false);
    expect(currencyRegistryLoaded()).toBe(false);
    // O que se perde é a LISTA de moedas oferecidas, nunca o desenho de um valor.
    expect(offeredCurrencies()).toEqual([]);
    expect(currencyInfo("EUR").symbol).toBe("€");
  });

  it("depois de uma falha, uma nova tentativa é permitida", async () => {
    vi.mocked(listCurrencies).mockRejectedValueOnce(new Error("503"));
    await ensureCurrencyRegistry();

    vi.mocked(listCurrencies).mockResolvedValueOnce(REGISTRO);
    await ensureCurrencyRegistry();

    expect(currencyRegistryLoaded()).toBe(true);
  });
});
