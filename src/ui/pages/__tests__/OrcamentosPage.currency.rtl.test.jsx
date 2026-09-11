/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

/**
 * Os literais usam `\u00a0` de propósito: o `Intl` separa símbolo e número com
 * ESPAÇO INQUEBRÁVEL, e escrito com o caractere comum este teste falha por um byte
 * que ninguém vê. Custou uma rodada vermelha para lembrar.
 *
 * O que a tela de orçamento ESCREVE quando o orçamento não é em real.
 *
 * Dois defeitos que só o texto desenhado denuncia: um limite de € 800 saindo
 * "R$\u00a0800,00" (número certo, unidade errada), e um gasto em outra moeda que o
 * orçamento não mede simplesmente não existindo na tela.
 */

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const useBudgetsDataMock = vi.fn();
vi.mock("../../features/budgets/useBudgetsData.js", () => ({
  useBudgetsData: (args) => useBudgetsDataMock(args),
}));
vi.mock("../../features/budgets/BudgetHistoryChart.jsx", () => ({
  BudgetHistoryChart: () => null,
}));

import { OrcamentosPage } from "../OrcamentosPage.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";

const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
];

function comOrcamentos(cats, resumo = {}) {
  useBudgetsDataMock.mockImplementation(() => ({
    isLoading: false,
    isSaving: false,
    error: "",
    data: {
      budget: 800,
      totalGasto: 300,
      totalDisp: 500,
      totalPct: 38,
      alertCount: 0,
      healthLabel: "ok",
      // Uma organização com UM orçamento em euro tem o resumo em euro: o `moeda`
      // do resumo vem do adapter, e um mock que o omitisse estaria descrevendo uma
      // organização que não existe.
      moeda: "EUR",
      porMoeda: [],
      gastoPorMoeda: [],
      cats,
      ...resumo,
    },
    choices: [],
    history: [],
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    reload: vi.fn(),
  }));
}

const CAT_EUR = {
  id: "b1", slug: "moradia", budgetId: "b1", tagId: "t1", nome: "Moradia",
  categoryIconKey: null, emoji: "🏠", limite: 800, gasto: 300, moeda: "EUR",
  membros: [], envelopes: [], navFilter: "t1", color: "#888", foraDoOrcamento: [],
};

beforeEach(() => {
  setCurrencyRegistry(REGISTRO);
  useBudgetsDataMock.mockReset();
});
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

const desenhar = () =>
  render(<OrcamentosPage organizationId="org-1" dataMode="live" />).container.textContent ?? "";

describe("orçamento em euro", () => {
  it("mostra o limite e o consumo em EURO, não em real", () => {
    comOrcamentos([CAT_EUR]);

    const texto = desenhar();

    expect(texto).toContain("€\u00a0300,00");
    expect(texto).toContain("€\u00a0800,00");
    expect(texto).not.toContain("R$\u00a0300,00");
    expect(texto).not.toContain("R$\u00a0800,00");
  });
});

describe("gasto em outra moeda", () => {
  it("aparece identificado como fora do orçamento, com valor e moeda", () => {
    comOrcamentos([{ ...CAT_EUR, foraDoOrcamento: [{ valor: 150, moeda: "BRL" }] }]);

    const texto = desenhar();

    expect(texto).toContain("Fora deste orçamento");
    expect(texto).toContain("R$\u00a0150,00");
    expect(texto).toMatch(/outra moeda, que o limite não mede/);
  });

  it("NÃO é somado ao consumo — o orçamento continua em 300 de 800", () => {
    // Somar R$ 5.000 num orçamento de € 800 o faria parecer estourado por uma
    // conversão que ninguém pediu.
    comOrcamentos([{ ...CAT_EUR, foraDoOrcamento: [{ valor: 5000, moeda: "BRL" }] }]);

    const texto = desenhar();

    expect(texto).toContain("€\u00a0300,00");
    expect(texto).not.toContain("🔴");
  });

  it("sem gasto de fora, a linha não aparece", () => {
    comOrcamentos([CAT_EUR]);

    expect(desenhar()).not.toContain("Fora deste orçamento");
  });
});

describe("quem só tem reais", () => {
  it("vê exatamente o que via — nada de linha nova", () => {
    comOrcamentos([{ ...CAT_EUR, moeda: "BRL", foraDoOrcamento: [] }], { moeda: "BRL" });

    const texto = desenhar();

    expect(texto).toContain("R$\u00a0300,00");
    expect(texto).toContain("R$\u00a0800,00");
    expect(texto).not.toContain("Fora deste orçamento");
  });
});

describe("orçamentos em mais de uma moeda", () => {
  it("o cabeçalho não soma — vira travessão com a quebra por baixo", () => {
    // € 800 + R$ 500 = 1.300 é um número de moeda nenhuma. O `reduce` que fazia
    // isso vivia no adapter, e a tela o carimbava com "R$".
    comOrcamentos(
      [CAT_EUR, { ...CAT_EUR, id: "b2", nome: "Mercado", limite: 500, gasto: 200, moeda: "BRL" }],
      {
        budget: null,
        totalGasto: null,
        totalDisp: null,
        totalPct: null,
        moeda: null,
        porMoeda: [{ moeda: "BRL", valor: 500 }, { moeda: "EUR", valor: 800 }],
        gastoPorMoeda: [{ moeda: "BRL", valor: 200 }, { moeda: "EUR", valor: 300 }],
      },
    );

    const texto = desenhar();

    expect(texto).not.toContain("1.300");
    expect(texto).toContain("R$\u00a0500,00");
    expect(texto).toContain("€\u00a0800,00");
    expect(texto).toContain("sem total: mais de uma moeda");
    // Zero afirmaria que não há orçamento nenhum.
    expect(texto).not.toContain("R$\u00a00,00");
  });
});
