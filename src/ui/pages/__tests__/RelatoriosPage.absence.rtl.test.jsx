/** @vitest-environment jsdom */

/**
 * Quando a organização tem contas em mais de uma moeda e falta cotação, os totais
 * de análise voltam `null` de propósito — o backend não soma euro com real (#170).
 *
 * Esta tela é feita de somas e percentuais desses totais, e `Number(null)` é `0`:
 * sem a guarda, ela desenharia um relatório inteiro afirmando um período de receita
 * e gasto ZERO. O que ela mostra no lugar é o que realmente há, por moeda, que não
 * depende de cotação nenhuma.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RelatoriosPage } from "../RelatoriosPage.jsx";

const live = {
  currencyUnavailable: null,
  byCurrency: [],
};

vi.mock("../../features/reports/useReportsData.js", () => ({
  useReportsData: () => ({
    isLoading: false,
    error: "",
    monthlyData: [],
    driftData: [],
    driftColors: {},
    compositionData: [],
    compositionWindowLabel: null,
    waterfallRows: [],
    velocityDaily: [],
    kpis: { periodTotalR: 0, periodTotalG: 0 },
    hasRealData: true,
    currencyUnavailable: live.currencyUnavailable,
    byCurrency: live.byCurrency,
  }),
}));

afterEach(cleanup);

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

const props = { dataMode: "live", organizationId: "org-1" };

describe("RelatoriosPage sem cotação para consolidar", () => {
  it("explica o motivo e mostra a quebra por moeda, sem desenhar gráfico nenhum", () => {
    live.currencyUnavailable = "sem cotação BRL→EUR para 2026-09-09";
    live.byCurrency = [
      { currency: "BRL", income: 100, expenses: 40 },
      { currency: "EUR", income: 15.5, expenses: 5.25 },
    ];

    render(<RelatoriosPage {...props} />);

    expect(screen.getByText(/Não foi possível converter/i)).toBeInTheDocument();
    expect(screen.getByText(/sem cotação BRL→EUR/)).toBeInTheDocument();
    expect(screen.getByText("BRL")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();
    // Um gráfico aqui seria uma afirmação sobre números que não existem.
    expect(screen.queryAllByTestId("grafico")).toHaveLength(0);
  });

  it("com cotação, a tela segue exatamente como era", () => {
    live.currencyUnavailable = null;
    live.byCurrency = [];

    render(<RelatoriosPage {...props} />);

    expect(screen.queryByText(/Não foi possível converter/i)).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("grafico").length).toBeGreaterThan(0);
  });
});
