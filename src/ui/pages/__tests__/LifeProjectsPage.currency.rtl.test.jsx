/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * O que a tela de metas ESCREVE quando a meta não é em real.
 *
 * Os literais usam ` `: o `Intl` separa símbolo e número com espaço
 * INQUEBRÁVEL, e escrito com o caractere comum a asserção falha por um byte que
 * ninguém vê.
 */

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const useGoalsDataMock = vi.fn();
vi.mock("../../features/goals/useGoalsData.js", () => ({
  useGoalsData: (args) => useGoalsDataMock(args),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";

const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
];

const META = {
  id: "g1", nome: "Viagem Europa", desc: "", status: "active", type: "travel",
  meta: 18000, atual: 5200, progress: 29, monthly_target: 600,
  annual_return_rate: null, deadline: "2027-07-01", prazo: "Jul 2027",
  term: "medium", termExplicit: null, prioridade: "media", moeda: "EUR",
};

function comMetas(goals) {
  useGoalsDataMock.mockImplementation(() => ({
    isLoading: false,
    isSaving: false,
    error: "",
    goals,
    hasLoaded: true,
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    contribute: vi.fn(),
    reload: vi.fn(),
  }));
}

beforeEach(() => {
  setCurrencyRegistry(REGISTRO);
  useGoalsDataMock.mockReset();
});
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

const desenhar = () =>
  render(<LifeProjectsPage organizationId="org-1" dataMode="live" />).container.textContent ?? "";

describe("meta em euro", () => {
  it("mostra o alvo e o progresso em EURO, não em real", () => {
    comMetas([META]);

    const texto = desenhar();

    expect(texto).toContain("€ 18.000,00");
    expect(texto).not.toContain("R$ 18.000,00");
  });

  it("o aporte mensal também sai na moeda da meta", () => {
    comMetas([META]);

    expect(desenhar()).toContain("€ 600,00");
  });
});

describe("metas em moedas diferentes", () => {
  it("o total não soma — mostra a quebra", () => {
    // 18.000 euros + 30.000 reais = 48.000 é um número de moeda nenhuma.
    comMetas([META, { ...META, id: "g2", nome: "Reserva", meta: 30000, atual: 18500, moeda: "BRL" }]);

    const texto = desenhar();

    expect(texto).not.toContain("48.000");
    expect(texto).toContain("€ 18.000,00");
    expect(texto).toContain("R$ 30.000,00");
  });

  it("o percentual do objetivo some — 5.200 euros sobre 30.000 reais não é fração de nada", () => {
    comMetas([META, { ...META, id: "g2", nome: "Reserva", meta: 30000, atual: 18500, moeda: "BRL" }]);

    expect(desenhar()).not.toContain("% do objetivo");
  });
});

describe("quem só tem reais", () => {
  it("vê exatamente o que via", () => {
    comMetas([{ ...META, moeda: "BRL" }]);

    const texto = desenhar();

    expect(texto).toContain("R$ 18.000,00");
    expect(texto).toContain("% do objetivo");
  });
});
