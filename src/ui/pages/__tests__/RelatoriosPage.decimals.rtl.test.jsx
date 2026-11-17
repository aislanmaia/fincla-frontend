/** @vitest-environment jsdom */

/**
 * fincla-api#534 — os valores em dinheiro dos Relatórios usam as casas da moeda base, pelo registro de moedas.
 * O card "Acumulado em 6m" mostrava "US$ 2.499,6": o formatador cortava o zero final (`minimumFractionDigits: 0`).
 * O registro é a autoridade das casas; uma moeda de três casas e uma sem casas provam que ninguém fixou "2".
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";
import { RelatoriosPage } from "../RelatoriosPage.jsx";

const nbsp = " ";

const live = { monthlyData: [] };
vi.mock("../../features/reports/useReportsData.js", () => ({
  useReportsData: () => ({
    isLoading: false,
    error: "",
    monthlyData: live.monthlyData,
    driftData: [],
    driftColors: {},
    compositionData: [],
    compositionWindowLabel: null,
    waterfallRows: [],
    velocityDaily: [],
    kpis: {},
    hasRealData: true,
    currencyUnavailable: null,
    byCurrency: [],
  }),
}));

let baseCurrency = "USD";
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-1", base_currency: baseCurrency })),
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

vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough,
    Area: () => null,
    BarChart: passthrough,
    ComposedChart: passthrough,
    PieChart: passthrough,
    Pie: () => null,
    Bar: () => null,
    Line: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
  };
});

beforeEach(() => {
  setCurrencyRegistry([
    { code: "BRL", symbol: "R$", decimal_places: 2 },
    { code: "USD", symbol: "US$", decimal_places: 2 },
    { code: "KWD", symbol: "KD", decimal_places: 3 },
    { code: "JPY", symbol: "¥", decimal_places: 0 },
  ]);
  // Dois meses: receita 3.000,00 → saldo acumulado 2.499,60 (o mês corrente tem saldo 1.200,50).
  live.monthlyData = [
    { mes: "Set'26", receita: 1500, gasto: 201.1, saldo: 1298.9, score: 70 },
    { mes: "Out'26", receita: 1500, gasto: 299.3, saldo: 1200.7, score: 70 },
  ];
});

afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

const props = { dataMode: "live", organizationId: "org-1" };

describe("Relatórios: casas decimais da moeda base", () => {
  it.each([
    ["USD", `US$${nbsp}2.499,60`, `US$${nbsp}1.500,00`],
    ["BRL", `R$${nbsp}2.499,60`, `R$${nbsp}1.500,00`],
    ["KWD", `KD${nbsp}2.499,600`, `KD${nbsp}1.500,000`],
    ["JPY", `¥${nbsp}2.500`, `¥${nbsp}1.500`],
  ])("base %s: o acumulado e os cards levam as casas do registro", async (code, acumulado, receita) => {
    baseCurrency = code;
    render(<RelatoriosPage {...props} />);

    await waitFor(() => expect(document.body.textContent).toContain(acumulado));
    // O card "Receita" do mês, um número redondo: as casas aparecem mesmo zeradas.
    expect(document.body.textContent).toContain(receita);
    // Nada com uma casa só (o defeito: "2.499,6").
    expect(document.body.textContent).not.toMatch(/2\.499,6(?!\d)/);
  });
});
