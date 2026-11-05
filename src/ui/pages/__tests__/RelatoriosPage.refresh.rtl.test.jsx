/** @vitest-environment jsdom */

/**
 * #272 — depois de lançar uma transação, Relatórios seguia com os números antigos
 * até o F5. `useReportsData` roda de verdade; o dublê é a leitura de análise do
 * adapter (o limite HTTP). A resposta usada é a de "sem cotação" porque é a que
 * desenha números simples, por moeda, sem gráfico.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const fetchMock = vi.fn();
vi.mock("../../data/reportsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportsAnalytics: (...args) => fetchMock(...args),
}));
vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: vi.fn(() => Promise.resolve({ series: [] })),
}));

import { RelatoriosPage } from "../RelatoriosPage.jsx";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: ({ children }) => <div data-testid="grafico">{children}</div>,
    Area: () => null,
    BarChart: ({ children }) => <div data-testid="grafico">{children}</div>,
    ComposedChart: ({ children }) => <div data-testid="grafico">{children}</div>,
    PieChart: ({ children }) => <div data-testid="grafico">{children}</div>,
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


const result = (expenses) => ({
  monthlyData: [{ m: "nov", r: 100, g: expenses }],
  drift: { driftData: [], driftColors: {} },
  compositionData: [],
  compositionWindowLabel: null,
  waterfallRows: [],
  velocityDaily: [],
  currencyUnavailable: "sem cotação BRL→EUR para 2026-11-05",
  byCurrency: [
    { currency: "BRL", income: 100, expenses },
    { currency: "EUR", income: 15.5, expenses: 5.25 },
  ],
});

let gate;
beforeEach(() => {
  gate = null;
  fetchMock.mockImplementation(() => Promise.resolve(result(40)));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const page = (token) => <RelatoriosPage dataMode="live" organizationId="org-1" transactionsRefreshToken={token} />;
const text = () => document.body.textContent ?? "";

describe("Relatórios — recarrega depois de uma transação (#272)", () => {
  it("o token de transação salva relê e a tela mostra o número novo", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("40,00"));

    fetchMock.mockImplementation(() => Promise.resolve(result(77.3)));
    rerender(page(1));

    await waitFor(() => expect(text()).toContain("77,30"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("durante a recarga os números anteriores continuam", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("40,00"));

    fetchMock.mockImplementation(() => new Promise((resolve) => { gate = () => resolve(result(77.3)); }));
    rerender(page(1));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(text()).toContain("40,00");
    expect(screen.queryByText(/Carregando/i)).toBeNull();
    gate();
    await waitFor(() => expect(text()).toContain("77,30"));
  });

  it("uma falha na recarga não apaga o que se sabia", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("40,00"));

    fetchMock.mockImplementation(() => Promise.reject(new Error("boom")));
    rerender(page(1));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 30));

    expect(text()).toContain("40,00");
  });
});
