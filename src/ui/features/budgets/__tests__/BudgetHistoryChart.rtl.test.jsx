/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BudgetHistoryChart } from "../BudgetHistoryChart.jsx";
import { fmtAbs } from "../../../formatters.js";

afterEach(cleanup);

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="rc">{children}</div>,
  // O mock re-expõe `data` como texto para conseguirmos verificar, sem depender
  // de layout SVG real em jsdom, que os 6 meses chegam até o gráfico.
  BarChart: ({ data, children }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <span key={d.m} data-testid="month-label">
          {d.m}
        </span>
      ))}
      {children}
    </div>
  ),
  Bar: () => null,
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

const HISTORY_6M = [
  { m: "Out", spent: 5100, budget: 6000 },
  { m: "Nov", spent: 6300, budget: 6000 },
  { m: "Dez", spent: 7200, budget: 6200 },
  { m: "Jan", spent: 5800, budget: 6500 },
  { m: "Fev", spent: 5400, budget: 6500 },
  { m: "Mar", spent: 4381, budget: 6500, current: true },
];

describe("BudgetHistoryChart (RTL)", () => {
  it("renderiza o gráfico sem cair", () => {
    render(<BudgetHistoryChart historyData={HISTORY_6M} isMobile={false} shouldUseRealData={false} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("mostra os 6 meses do histórico no gráfico", () => {
    render(<BudgetHistoryChart historyData={HISTORY_6M} isMobile={false} shouldUseRealData={false} />);
    const labels = screen.getAllByTestId("month-label").map((el) => el.textContent);
    expect(labels).toEqual(["Out", "Nov", "Dez", "Jan", "Fev", "Mar"]);
  });

  it("formata os valores em pt-BR (R$ x.xxx,xx) nos destaques de mês atual e maior gasto", () => {
    render(<BudgetHistoryChart historyData={HISTORY_6M} isMobile={false} shouldUseRealData={false} />);
    // Mês atual = Março, gasto 4381
    expect(screen.getByText(fmtAbs(4381))).toBeInTheDocument();
    // Maior gasto = Dezembro, gasto 7200
    expect(screen.getByText(fmtAbs(7200))).toBeInTheDocument();
    // "Mês atual" aparece no chip e na legenda; "Maior gasto" só no chip.
    expect(screen.getAllByText("Mês atual").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Maior gasto")).toBeInTheDocument();
  });

  it("indica quando não há histórico suficiente", () => {
    render(<BudgetHistoryChart historyData={[]} isMobile={false} shouldUseRealData />);
    expect(screen.getByText(/não há histórico suficiente/i)).toBeInTheDocument();
  });

  it("mostra o aviso de limite indisponível apenas com dados reais (backend não expõe limite histórico)", () => {
    const realHistory = HISTORY_6M.map(({ m, spent, current }) => ({ m, spent, current }));
    render(<BudgetHistoryChart historyData={realHistory} isMobile={false} shouldUseRealData />);
    expect(screen.getByText(/backend ainda não expõe o limite histórico/i)).toBeInTheDocument();
  });
});
