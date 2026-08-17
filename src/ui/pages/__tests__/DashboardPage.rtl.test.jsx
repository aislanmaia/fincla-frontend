/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.jsx";

let mockDashboardData;

vi.mock("../../features/dashboard/useDashboardData.js", () => ({
  useDashboardData: () => mockDashboardData,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  CartesianGrid: () => null,
  ComposedChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

// Sem isto os renders se acumulam no mesmo DOM e um mesmo testid aparece N vezes.
afterEach(cleanup);

describe("DashboardPage (RTL)", () => {
  beforeEach(() => {
    mockDashboardData = {
      isLoading: false,
      error: "",
      summary: {
        total_income: 1000,
        total_expenses: 400,
        balance: 600,
        total_transactions: 2,
        recurring_in_period: {
          total_expense: 50,
          total_income: 0,
          period: { start_date: "2026-04-01", end_date: "2026-04-30" },
        },
      },
      transactions: [],
      categories: [],
      rhythmChart: [{ dia: 1, proj: 10, real: 5, dayLabel: "1" }],
      rhythmMeta: {
        dim: 30,
        today: 15,
        showTodayMarker: true,
        refLabel: "Hoje",
        progressSuffix: "",
        rhythmMode: "daily",
      },
      upcomingDebits: [],
      recurringSummary: { total_monthly_expense: 200 },
      recurringInPeriod: {
        total_expense: 50,
        total_income: 0,
        period: { start_date: "2026-04-01", end_date: "2026-04-30" },
      },
      hasRealData: true,
      refetch: vi.fn(),
    };
  });

  it("renderiza Visão Geral com KPIs quando o hook retorna resumo", () => {
    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );
    expect(screen.getByText("Geral")).toBeInTheDocument();
    expect(screen.getByText(/Receitas ·/)).toBeInTheDocument();
  });

  it("não mostra comparação falsa quando o avg não existe", () => {
    mockDashboardData = {
      ...mockDashboardData,
      categories: [
        {
          tagId: 1,
          name: "Alimentação",
          value: 220,
          avg: null,
          color: "#EF4444",
        },
      ],
    };

    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText(/\+22%/)).not.toBeInTheDocument();
    expect(screen.queryByText("referência")).not.toBeInTheDocument();
  });
});

describe('DashboardPage — KPI "Saldo em conta" (S2)', () => {
  function renderDash() {
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );
  }

  beforeEach(() => {
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: {
        as_of: "2026-08-16T12:00:00",
        total_available: 329.91,
        total_all: 329.91,
        account_count: 1,
        by_type: [],
      },
    };
  });

  it("mostra o saldo REAL das contas, não o resultado do período", () => {
    renderDash();
    const card = screen.getByTestId("dashboard-kpi-saldo-em-conta");
    expect(card).toHaveTextContent("Saldo em conta");
    expect(card).toHaveTextContent(/329,91/);
    // O KPI do período continua existindo e com o SEU número (600), separado.
    expect(screen.getByTestId("dashboard-kpi-saldo")).toHaveTextContent(/600/);
  });

  it("pluraliza a contagem de contas", () => {
    renderDash();
    expect(screen.getByTestId("dashboard-kpi-saldo-em-conta")).toHaveTextContent("em 1 conta");

    cleanup();
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: { ...mockDashboardData.balanceSummary, account_count: 3 },
    };
    renderDash();
    expect(screen.getByTestId("dashboard-kpi-saldo-em-conta")).toHaveTextContent("em 3 contas");
  });

  it("saldo negativo mostra o sinal — não pode parecer positivo", () => {
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: { ...mockDashboardData.balanceSummary, total_available: -1500 },
    };
    renderDash();
    const card = screen.getByTestId("dashboard-kpi-saldo-em-conta");
    // fmtAbs sozinho renderizaria "R$ 1.500,00", idêntico a um saldo positivo,
    // com a cor da seta como única pista. Conta no vermelho não pode mentir.
    expect(card).toHaveTextContent("−R$ 1.500,00");
    expect(card).toHaveTextContent(/negativa/);
  });

  it("degrada para '—' quando o saldo não vem — zero seria uma mentira plausível", () => {
    mockDashboardData = { ...mockDashboardData, balanceSummary: null };
    renderDash();
    const card = screen.getByTestId("dashboard-kpi-saldo-em-conta");
    expect(card).toHaveTextContent("—");
    expect(card).toHaveTextContent("Dados indisponíveis");
  });

  it("aparece mesmo quando o resumo do período falhou (fontes independentes)", () => {
    mockDashboardData = {
      ...mockDashboardData,
      summary: null,
      error: "backend fora",
      hasRealData: false,
    };
    renderDash();
    expect(screen.getByTestId("dashboard-kpi-saldo-em-conta")).toHaveTextContent(/329,91/);
  });
});
