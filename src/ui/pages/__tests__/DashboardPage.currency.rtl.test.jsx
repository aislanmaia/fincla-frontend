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
    // O valor do ritmo é dinheiro: casas da moeda, não um inteiro arredondado (QA BUG-04).
    expect(container.textContent).toMatch(/US\$ [\d.]+,\d{2} (à frente|acima) do ritmo/);
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

/**
 * BUG-05 (QA do Exportar, CT-26): org em BRL com uma conta em USD. "Últimas
 * Transações" e "Gastos por Categoria" escreviam "R$ 50,00" para uma despesa de
 * US$ 50 — formatavam toda LINHA na moeda base. Uma linha é o dinheiro dela.
 */
describe("DashboardPage — cada linha na moeda dela (BUG-05)", () => {
  beforeEach(() => {
    baseCurrency = "BRL";
  });

  it("lançamento e débito em US$ saem em US$; o total de débitos não soma moedas", async () => {
    mockDashboardData = {
      ...liveData(),
      transactions: [
        { id: "t1", desc: "Loja NY", cat: "Compras", val: -50, currency: "USD", date: "10/11", icon: null },
        { id: "t2", desc: "Padaria", cat: "Alimentação", val: -30, currency: "BRL", date: "09/11", icon: null },
      ],
      upcomingDebits: [
        { id: "d1", name: "Streaming", cat: "Lazer", value: 20, currency: "USD", daysLeft: 2, dateLabel: "19/11" },
        { id: "d2", name: "Aluguel", cat: "Moradia", value: 100, currency: null, daysLeft: 5, dateLabel: "22/11" },
      ],
    };
    const { container } = renderDash();
    await vi.waitFor(() =>
      expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("R$ 5.092,19"),
    );
    expect(container.textContent).toContain("−US$ 50,00");
    expect(container.textContent).not.toContain("R$ 50,00");
    expect(container.textContent).toContain("−R$ 30,00");
    expect(container.textContent).toContain("US$ 20,00");
    expect(container.textContent).toContain("R$ 100,00 + US$ 20,00");
    expect(container.textContent).not.toContain("R$ 120,00");
  });

  it("categoria sem total convertido (sem cotação) mostra travessão, não zero", async () => {
    mockDashboardData = {
      ...liveData(),
      categories: [{ tagId: 1, name: "Viagem", value: null, currency: "BRL", avg: null, color: "#EF4444" }],
    };
    renderDash();
    const row = await screen.findByText("Viagem");
    expect(row.parentElement.parentElement).toHaveTextContent("—");
    expect(row.parentElement.parentElement).not.toHaveTextContent("R$ 0,00");
  });

  it("categoria sem conversão mostra as somas por moeda lado a lado, sem somar", async () => {
    mockDashboardData = {
      ...liveData(),
      categories: [{
        tagId: 1, name: "Viagem", value: null, currency: null, avg: null, color: "#EF4444",
        byCurrency: [{ currency: "BRL", amount: 190.4 }, { currency: "USD", amount: 225.6 }],
      }],
    };
    renderDash();
    const row = await screen.findByText("Viagem");
    expect(row.parentElement.parentElement).toHaveTextContent("R$ 190,40 + US$ 225,60");
    expect(row.parentElement.parentElement).not.toHaveTextContent("R$ 416,00");
  });
});

/* QA display-and-pagination BUG-03/BUG-04: com 1.235 lançamentos e gastos acima do ritmo, a Visão Geral
   escrevia "1235 lançamentos no período" e "R$ 1063 acima do ritmo" (sem milhar e sem centavos). */
describe("DashboardPage — contagem com milhar e ritmo com as casas da moeda", () => {
  it.each([
    ["BRL", "R\\$"],
    ["USD", "US\\$"],
    ["EUR", "€"],
  ])("base %s", async (code, symbol) => {
    baseCurrency = code;
    mockDashboardData = liveData();
    mockDashboardData.summary = { ...mockDashboardData.summary, total_income: 30000, total_expenses: 29876.54, balance: 123.46, total_transactions: 1235 };
    const { container } = renderDash();
    await vi.waitFor(() => expect(container.textContent).toContain("1.235 lançamentos no período"));
    expect(container.textContent).not.toMatch(/1235 lançamentos/);
    await vi.waitFor(() => expect(container.textContent).toMatch(new RegExp(`${symbol} \\d{1,3}(\\.\\d{3})*,\\d{2} (à frente|acima) do ritmo`)));
    // Nada de inteiro cru (o defeito): "R$ 1063 acima do ritmo".
    expect(container.textContent).not.toMatch(/ \d{4,} (à frente|acima) do ritmo/);
  });
});
