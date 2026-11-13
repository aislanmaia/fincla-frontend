/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";

import { DashboardPage } from "../DashboardPage.jsx";

/**
 * #310 — com a base da organização em dólar, a Visão Geral escrevia "R$ 5.092,19" no
 * headline enquanto a linha de baixo dizia "Disponível US$ 5.092,19". Os valores já
 * vêm convertidos para a base pela API; o defeito era só a unidade, chapada em real.
 *
 * A moeda base vem do caminho de verdade: `useOrganizationBaseCurrency` → axios →
 * `GET /organizations/{id}`, com a rede (MSW) como único dublê. Os números da tela
 * vêm de `useDashboardData` mockado — aqui o que importa é a UNIDADE que a tela
 * escreve, não a conta.
 */

let mockDashboardData;
vi.mock("../../features/dashboard/useDashboardData.js", () => ({
  useDashboardData: () => mockDashboardData,
}));

// O eixo e o tooltip do gráfico de ritmo também escrevem dinheiro: os dublês
// chamam o formatador de verdade para que a unidade deles apareça no DOM.
vi.mock("recharts", async () => {
  const { cloneElement } = await import("react");
  return {
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    CartesianGrid: () => null,
    ComposedChart: ({ children }) => <div>{children}</div>,
    Line: () => null,
    ReferenceLine: () => null,
    XAxis: () => null,
    // O recharts chama `tickFormatter(valor, índice)`.
    YAxis: ({ tickFormatter }) => <span data-testid="y-tick">{tickFormatter?.(2000, 1)}</span>,
    Tooltip: ({ content }) => (
      <div data-testid="rhythm-tooltip">
        {cloneElement(content, {
          active: true,
          label: 1,
          payload: [{ name: "real", value: 12.5, color: "#000", payload: { dayLabel: "Dia 1" } }],
        })}
      </div>
    ),
  };
});

vi.mock("../../../api/recurringSeries", () => ({
  getRecurringProjection: () => Promise.reject(new Error("fora do escopo")),
}));

const ORG = "33333333-3333-4333-8333-333333333333";
let baseCurrency = "USD";
let orgDelayMs = 0;

const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, async () => {
    if (orgDelayMs) await delay(orgDelayMs);
    return HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency });
  }),
  // Saldo por conta, cotações etc.: fora do escopo — falham como a rede falharia.
  http.get("*", () => HttpResponse.json({ detail: "fora do escopo" }, { status: 503 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

function liveData() {
  return {
    isLoading: false,
    error: "",
    summary: {
      total_income: 1630.17,
      total_expenses: 27.93,
      balance: 1602.24,
      total_transactions: 3,
      recurring_in_period: { total_expense: 0, total_income: 0, period: { start_date: "2026-11-01", end_date: "2026-11-30" } },
    },
    balanceSummary: { as_of: "2026-11-13T12:00:00", total_available: 5092.19, total_all: 5092.19, account_count: 1, by_type: [] },
    transactions: [{ id: "t1", desc: "Mercado", cat: "Alimentação", val: -27.93, date: "2026-11-10", icon: null }],
    categories: [{ tagId: 1, name: "Alimentação", value: 27.93, avg: 20, color: "#EF4444" }],
    rhythmChart: [{ dia: 1, proj: 10, real: 5, dayLabel: "1" }],
    rhythmMeta: { dim: 30, today: 13, showTodayMarker: true, refLabel: "Hoje", progressSuffix: "", rhythmMode: "daily" },
    upcomingDebits: [{ id: "d1", desc: "Aluguel", value: 1200, date: "2026-11-20", daysLeft: 7 }],
    recurringSummary: { total_monthly_expense: 0 },
    recurringInPeriod: { total_expense: 0, total_income: 0, period: { start_date: "2026-11-01", end_date: "2026-11-30" } },
    hasRealData: true,
    refetch: vi.fn(),
  };
}

function renderDash(props = {}) {
  return render(
    <DashboardPage
      onNav={vi.fn()}
      stateCtrl={{ mounted: true, isMobile: false }}
      dataMode="live"
      organizationId={ORG}
      onNewTx={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  baseCurrency = "USD";
  orgDelayMs = 0;
  mockDashboardData = liveData();
});

describe("DashboardPage — valores na moeda base da organização (#310)", () => {
  it("base USD: o headline e todo o resto saem em US$, nenhum R$ na tela", async () => {
    const { container } = renderDash();
    const headline = screen.getByTestId("dashboard-headline-saldo-conta");
    await vi.waitFor(() => expect(headline).toHaveTextContent("US$ 5.092,19"));

    expect(screen.getByTestId("dashboard-headline-resultado")).toHaveTextContent("US$ 1.602,24");
    expect(screen.getAllByText("US$ 1.630,17").length).toBeGreaterThan(0); // receitas
    expect(screen.getByTestId("y-tick")).toHaveTextContent("US$2.0k");
    expect(screen.getByTestId("rhythm-tooltip")).toHaveTextContent("US$ 12,50");
    expect(container.textContent).toMatch(/US\$ \d+ (à frente|acima) do ritmo/);
    expect(container.textContent).not.toMatch(/R\$/);
  });

  it("base EUR: escreve €", async () => {
    baseCurrency = "EUR";
    const { container } = renderDash();
    await vi.waitFor(() =>
      expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("€ 5.092,19"),
    );
    expect(container.textContent).not.toMatch(/R\$/);
  });

  it("base BRL: a saída continua byte a byte a de antes", async () => {
    baseCurrency = "BRL";
    renderDash();
    await vi.waitFor(() =>
      expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("R$ 5.092,19"),
    );
    expect(screen.getByTestId("y-tick")).toHaveTextContent("R$2.0k");
    expect(screen.getByTestId("rhythm-tooltip")).toHaveTextContent("R$ 12,50");
  });

  it("enquanto a base não chega, nenhum valor aparece em R$ — travessão", async () => {
    orgDelayMs = 200;
    const { container } = renderDash();
    expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("—");
    expect(container.textContent).not.toMatch(/R\$/);
    await vi.waitFor(() =>
      expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("US$ 5.092,19"),
    );
  });

  it("estado inicial (pós-onboarding, sem lançamentos) também na base", async () => {
    mockDashboardData = { ...liveData(), hasRealData: false, summary: null, balanceSummary: null };
    const { container } = renderDash({
      extraRecs: [{ desc: "Salário", dia: 5, val: 3000, valorTipo: "fixo" }],
    });
    await vi.waitFor(() => expect(container.textContent).toContain("US$ 3.000,00"));
    expect(container.textContent).toContain("US$ 0");
    expect(container.textContent).not.toMatch(/R\$/);
  });
});
