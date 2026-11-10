/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.jsx";

let mockReserved = null;
vi.mock("../../features/goals/useReservedSummary.js", () => ({
  useReservedSummary: () => mockReserved,
}));

let mockDashboardData;

vi.mock("../../features/dashboard/useDashboardData.js", () => ({
  useDashboardData: () => mockDashboardData,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  CartesianGrid: () => null,
  ComposedChart: ({ children, data }) => (
    <div data-testid="composed-chart" data-points={JSON.stringify(data ?? [])}>{children}</div>
  ),
  Line: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

/**
 * `getRecurringProjection` é chamada pela própria página, não pelo hook mockado.
 * `null` simula endpoint fora do ar — que é o padrão dos testes que não se importam
 * com a projeção, e o caso em que a barra não pode prometer "depois das recorrências".
 */
let projectionItems = null;
let projectionCalls = 0;
vi.mock("../../../api/recurringSeries", () => ({
  getRecurringProjection: () =>
    ++projectionCalls && projectionItems === null
      ? Promise.reject(new Error("projeção fora do ar"))
      : Promise.resolve({ items: projectionItems }),
}));

// Sem isto os renders se acumulam no mesmo DOM e um mesmo testid aparece N vezes.
afterEach(cleanup);

/**
 * Baseline explícito, em função.
 *
 * Antes cada `describe` espalhava (`...mockDashboardData`) o que o describe anterior
 * tinha deixado na variável — os testes passavam pela ORDEM em que rodam. Com a
 * fábrica, cada bloco parte do mesmo estado conhecido.
 */
function baseData() {
  return {
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
}

beforeEach(() => {
  projectionItems = null;
  mockDashboardData = baseData();
});

/**
 * Todo aporte sai de algum lugar (Owner, 2026-11-05). O que fica reservado nas metas
 * continua no saldo do banco, mas a Visão Geral abre pelo que dá para gastar.
 */
describe("DashboardPage — reserva das metas no saldo", () => {
  function renderDash() {
    return render(
      <DashboardPage onNav={vi.fn()} stateCtrl={{ mounted: true, isMobile: false }} dataMode="live" organizationId="org-rtl" onNewTx={vi.fn()} />,
    );
  }
  const balance = (total) => ({
    as_of: "2026-11-09T12:00:00", total_available: total, total_all: total, account_count: 1, by_type: [],
    consolidation: { target_currency: "BRL", rates: [], unavailable: null },
  });

  beforeEach(() => {
    mockReserved = null;
    mockDashboardData = { ...baseData(), balanceSummary: balance(5000) };
  });

  it("com reserva: abre pelo disponível, mostra o total, a reserva por meta e a sugestão", () => {
    mockReserved = {
      totals: [{ currency: "BRL", amount: 400 }],
      by_account: [],
      by_goal: [{ goal_id: "g1", name: "Viagem para o Nordeste", currency: "BRL", amount: 400 }],
    };
    renderDash();
    const headline = screen.getByTestId("dashboard-headline-saldo-conta");
    expect(headline.textContent).toContain("Disponível para gastar");
    expect(headline.textContent).toMatch(/R\$\s4\.600,00/);
    expect(headline.textContent).toMatch(/de R\$\s5\.000,00 no total/);
    const breakdown = screen.getByTestId("goal-reserve-breakdown");
    expect(breakdown.textContent).toContain("Reservado em 1 meta");
    expect(breakdown.textContent).toContain("Viagem para o Nordeste");
    expect(breakdown.textContent).toMatch(/Gaste até R\$\s4\.600,00 sem mexer nas suas metas/);
  });

  it("gastos acima do disponível: avisa que o dinheiro das metas está sendo usado", () => {
    mockDashboardData = { ...baseData(), balanceSummary: balance(250) };
    mockReserved = { totals: [{ currency: "BRL", amount: 400 }], by_account: [], by_goal: [{ goal_id: "g1", name: "Viagem", currency: "BRL", amount: 400 }] };
    renderDash();
    expect(screen.getByTestId("goal-reserve-breakdown").textContent).toMatch(/usando R\$\s150,00 do dinheiro das metas/);
  });

  it("sem reserva (ou leitura de reserva falhou): o cartão fica como sempre foi", () => {
    renderDash();
    const headline = screen.getByTestId("dashboard-headline-saldo-conta");
    expect(headline.textContent).toContain("Saldo em conta");
    expect(headline.textContent).toMatch(/R\$\s5\.000,00/);
    expect(screen.queryByTestId("goal-reserve-breakdown")).not.toBeInTheDocument();
  });

  it("o conselho por dia usa o disponível, não o saldo com a reserva dentro", () => {
    // Sobra do ciclo = 600; saldo 5.000 com 4.940 reservados → disponível 60.
    mockReserved = { totals: [{ currency: "BRL", amount: 4940 }], by_account: [], by_goal: [{ goal_id: "g1", name: "Viagem", currency: "BRL", amount: 4940 }] };
    renderDash();
    const hoje = new Date();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const dias = Math.max(1, Math.floor((new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()) - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000) + 1);
    const esperado = `R$ ${Math.round(60 / dias).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    expect(insight.textContent.replace(/\u00a0/g, " ")).toContain(`${esperado}/dia`);
  });
});
