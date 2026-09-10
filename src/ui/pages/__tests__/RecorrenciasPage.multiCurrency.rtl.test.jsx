/** @vitest-environment jsdom */

/**
 * O que a tela ESCREVE numa organização com duas moedas.
 *
 * O smoke em produção de 2026-09-09 leu `800,00 BRL` como total mensal numa
 * organização que tem R$ 800 e € 50: a fatia em real publicada como se fosse o
 * total, com os € 50 fora da conta. O backend passou a mandar `null` nesse caso,
 * e o risco imediato virou o outro: o `|| 0` da tela transformar o `null` em
 * "R$ 0,00", que afirma o oposto — a pessoa não gasta nada por mês.
 *
 * Nenhum teste de unidade vê isso, porque os dois defeitos são sobre o texto
 * desenhado, não sobre o número calculado.
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecorrenciasPage } from "../RecorrenciasPage.jsx";

const LINHA_BRL = {
  id: "rt-brl",
  logicalSeriesId: "log-brl",
  desc: "Internet",
  cat: "Utilidades",
  tipo: "despesa",
  val: 800,
  moeda: "BRL",
  ativa: true,
  dia: 10,
  metodo: "Boleto",
  nextOccurrenceIso: "2026-10-10",
  proximo: "10/10/2026",
  proximoFull: "10/10/2026",
  freq: "Mensal · dia 10",
  inicio: "Jan 2026",
  enc: "Sem data fim",
  urgente: false,
  diasUrg: null,
  pago: false,
  categoryIconKey: null,
  valorTipo: "fixo",
  progPct: 0,
  status: "ativa",
  freqId: "mensal",
  methodId: "boleto",
  encId: "sem-fim",
  endDateRaw: null,
  creditCardId: null,
  categoryTagId: null,
};

const LINHA_EUR = {
  ...LINHA_BRL,
  id: "rt-eur",
  logicalSeriesId: "log-eur",
  desc: "Aluguel de Lisboa",
  cat: "Moradia",
  val: 50,
  moeda: "EUR",
  dia: 5,
  nextOccurrenceIso: "2026-10-05",
  proximo: "05/10/2026",
  proximoFull: "05/10/2026",
  freq: "Mensal · dia 5",
};

vi.mock("../../features/recurringTransactions/useRecurringTransactionsData.js", () => ({
  useRecurringTransactionsData: () => ({
    isLoading: false,
    error: "",
    isTogglingId: null,
    isDeletingId: null,
    list: [LINHA_BRL, LINHA_EUR],
    summary: {
      // Como o backend responde quando não existe um total numa moeda só.
      totalRec: null,
      totalDesp: null,
      saldoFixo: null,
      moeda: null,
      porMoeda: [
        { currency: "BRL", total_monthly_income: 0, total_monthly_expense: 800, active_count: 1 },
        { currency: "EUR", total_monthly_income: 0, total_monthly_expense: 50, active_count: 1 },
      ],
      activeCount: 2,
      pausedCount: 0,
    },
    toggleRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    hasRealData: true,
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

function renderPage() {
  return render(
    <RecorrenciasPage
      onNav={vi.fn()}
      cenarios={[]}
      dataMode="live"
      organizationId="org-multimoeda"
      recurringRefreshToken={0}
      onNovaRec={vi.fn()}
      onEditar={vi.fn()}
      isMobile={false}
    />,
  );
}

const semEspacoEstranho = (texto) => texto.replace(/ /g, " ");

describe("Recorrências com mais de uma moeda", () => {
  it("não publica um total onde não existe um", () => {
    const { container } = renderPage();

    const textos = semEspacoEstranho(container.textContent);
    // As duas mentiras possíveis: a fatia em real vestida de total (foi o que
    // produção fez), e a soma nominal 800 + 50 = 850, que não é dinheiro de
    // moeda nenhuma.
    expect(textos).toContain("Compromissos mensais—");
    expect(textos).not.toContain("R$ 850,00");
    expect(textos).not.toContain("Compromissos mensaisR$ 800,00");
    // E o saldo fixo diz POR QUE não há número, em vez de mostrar zero.
    expect(textos).toContain("Saldo fixo mensal—sem total: mais de uma moeda");
  });

  it("mostra a quebra por moeda no lugar do total ausente", () => {
    const { container } = renderPage();

    const textos = semEspacoEstranho(container.textContent);
    expect(textos).toContain("R$ 800,00");
    expect(textos).toMatch(/€\s?50,00/);
  });

  it("desenha cada série na moeda dela", () => {
    renderPage();

    // A linha em euro não pode sair com cifrão de real ao lado do 50.
    expect(screen.getAllByText(/€\s?50,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText(/R\$\s?50,00/)).toHaveLength(0);
  });
});
