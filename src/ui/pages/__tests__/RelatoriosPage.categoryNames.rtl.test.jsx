/** @vitest-environment jsdom */

/**
 * QA display-and-pagination BUG-01 — a organização renomeou a categoria do sistema "Saúde" (Health) para
 * "Saude da Familia QA". Transações, Visão Geral, cartão e arquivo mostravam o nome da organização; os
 * Relatórios escreviam "Saúde", porque `/analytics/by-category` e `/spending-rhythm` só mandavam `tag_name`
 * cru ("Health") e a tela o traduzia. A API agora manda `tag_label`; a tela o usa nos três lugares
 * (composição, evolução por categoria e cascata). Mocka só a camada de API: o adaptador e o hook rodam de verdade.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";
import { RelatoriosPage } from "../RelatoriosPage.jsx";

const RENAMED = "Saude da Familia QA";
const money = (amount) => ({ amount: String(amount), currency: "BRL" });

const renamed = { tag_id: "h1", tag_name: "Health", tag_label: RENAMED, tag_system_key: "health", tag_color: "#DC2626" };
const taxes = { tag_id: "x1", tag_name: "Taxes & Fees", tag_label: "Impostos e taxas", tag_system_key: "taxes_fees", tag_color: "#A16207" };

/* Os valores já desembrulhados, como `unwrapMoney` os entrega ao adaptador. */
vi.mock("../../../api/analytics", () => ({
  getMonthlyEvolution: vi.fn(() => Promise.resolve({
    months: [
      { year: 2026, month: 10, total_income: 2000, total_expenses: 900, balance: 1100, by_currency: [] },
      { year: 2026, month: 11, total_income: 3000, total_expenses: 1100, balance: 1900, by_currency: [] },
    ],
    currency_unavailable: null,
  })),
  getSpendingRhythm: vi.fn(() => Promise.resolve({
    months: ["out/26", "nov/26"],
    categories: [
      { ...renamed, monthly_totals: [500, 800], average: 650, trend: "increasing" },
      { ...taxes, monthly_totals: [400, 300], average: 350, trend: "decreasing" },
    ],
    monthly_totals: [900, 1100],
  })),
  getByCategory: vi.fn(() => Promise.resolve({
    categories: [
      { ...renamed, total: 800, percentage: 72.7, transaction_count: 3 },
      { ...taxes, total: 300, percentage: 27.3, transaction_count: 1 },
    ],
    total_amount: 1100,
  })),
}));
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: vi.fn(() => Promise.resolve({ data: [], pagination: { has_next: false } })),
}));
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-1", base_currency: "BRL" })),
}));
vi.mock("../../../api/recurringSeries", async (importOriginal) => ({
  ...(await importOriginal()),
  listRecurringSeries: vi.fn(() => Promise.resolve({ series: [] })),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/* Os gráficos viram listas com os nomes das séries/fatias: é o que o Recharts desenharia. */
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough,
    Area: ({ dataKey }) => <span data-testid="area">{dataKey}</span>,
    BarChart: passthrough,
    ComposedChart: passthrough,
    PieChart: passthrough,
    Pie: ({ data }) => <ul data-testid="pie">{(data ?? []).map((d) => <li key={d.name}>{d.name}</li>)}</ul>,
    Bar: () => null,
    Line: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    Legend: () => null,
  };
});

beforeEach(() => {
  setCurrencyRegistry([{ code: "BRL", symbol: "R$", decimal_places: 2 }]);
});

afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

describe("Relatórios: categoria do sistema renomeada pela organização", () => {
  it("mostra o nome da organização na composição, na evolução por categoria e na cascata — nunca 'Saúde'", async () => {
    render(<RelatoriosPage dataMode="live" organizationId="org-1" />);

    await waitFor(() => expect(document.body.textContent).toContain(RENAMED));

    // Composição (a rosca e a legenda).
    const pieNames = [...document.querySelectorAll('[data-testid="pie"] li')].map((li) => li.textContent);
    expect(pieNames).toContain(RENAMED);
    // Evolução por categoria (uma área por categoria, chaveada pelo nome).
    const areaKeys = [...document.querySelectorAll('[data-testid="area"]')].map((el) => el.textContent);
    expect(areaKeys).toContain(RENAMED);
    // Cascata (SVG próprio: cada barra leva o nome inteiro no <title>) e a frase sobre ela.
    const barTitles = [...document.querySelectorAll("svg title")].map((el) => el.textContent);
    expect(barTitles).toContain(RENAMED);
    expect(document.body.textContent).toContain(`${RENAMED} + Impostos e taxas`);

    expect(document.body.textContent).not.toContain("Saúde");
    expect(document.body.innerHTML).not.toContain("Saúde");
  });
});
