/** @vitest-environment jsdom */

/**
 * #310 — o simulador projeta na moeda base da organização, mas escrevia "R$" chapado
 * (formatadores sem moeda, literais "R$ …" e a recomendação "reduz para R$ 66.67").
 * A base vem pela rede (MSW) com o hook de verdade; a simulação vem do adapter.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useSearch: () => ({}),
}));

vi.mock("../../data/simulationAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  simulateForUi: () => Promise.resolve(RESULT),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough, Area: () => null,
    BarChart: passthrough, Bar: () => null,
    ComposedChart: passthrough, Line: () => null,
    PieChart: passthrough, Pie: () => null, Cell: () => null,
    XAxis: () => null,
    YAxis: ({ tickFormatter }) => <span>{tickFormatter?.(2000, 1)}</span>,
    CartesianGrid: () => null, Tooltip: () => null, ReferenceLine: () => null, Legend: () => null,
  };
});

import { SimulacaoPage } from "../SimulacaoPage.jsx";

const ORG = "55555555-5555-4555-8555-555555555555";
const RESULT = {
  months: [
    { month: "2026-12", projected_income: 5000, base_expenses: 4000, card_commitments: 1200, savings_goal: 0, total_expenses: 5200, balance: -200, status: "warning" },
  ],
  global_verdict: "high-risk",
  summary: { total_projected_income: 5000, total_base_expenses: 4000, total_card_commitments: 1200, total_savings_goal: 0 },
  currency_unavailable: null,
  income_by_currency: [],
  base_expenses_by_currency: [],
};
const CENARIO = {
  id: 1,
  nome: "Cenário",
  budgetOverride: null,
  items: [{ id: 1, tipo: "despesa_parcelada", nome: "Notebook", cat: "Tecnologia", total: 1200, valParcela: 100, parcelas: 12, isReceita: false }],
};

let baseCurrency;
const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, () => HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency })),
  http.get("*", () => HttpResponse.json({ detail: "fora do escopo" }, { status: 503 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
beforeEach(() => {
  baseCurrency = "USD";
});

const text = () => document.body.textContent ?? "";
const renderPage = () =>
  render(
    <SimulacaoPage cenarios={[CENARIO]} setCenarios={() => {}} cenarioId={1} setCenarioId={() => {}} organizationId={ORG} />,
  );

describe("Simulação — valores na moeda base (#310)", () => {
  it("base USD: itens, totais, eixo e recomendação em US$, nenhum R$", async () => {
    renderPage();
    await waitFor(() => expect(text()).toContain("US$ 1.200,00"));
    // A recomendação de parcelar em 18× saía "R$ 66.67" (ponto en-US, unidade chapada).
    await waitFor(() => expect(text()).toContain("reduz o impacto mensal para US$ 66,67"));
    expect(text()).toContain("US$2.0k");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: continua em real", async () => {
    baseCurrency = "BRL";
    renderPage();
    await waitFor(() => expect(text()).toContain("R$ 1.200,00"));
  });
});
