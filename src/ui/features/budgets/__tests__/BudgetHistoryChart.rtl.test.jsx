/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BudgetHistoryChart } from "../BudgetHistoryChart.jsx";
import { fmtAbs, fmtK } from "../../../formatters.js";
import { toAmount } from "../../../../api/money";
import { T } from "../../../tokens.js";

afterEach(cleanup);

// O mock re-expõe as props que a produção depende para funcionar, em vez de só
// "engolir" o gráfico: `data` (meses chegam ao BarChart), `margin` (regressão do
// rótulo da média sendo cortado pelo SVG), `Cell.fill/fillOpacity` (destaque de
// mês atual / acima do limite) e `Tooltip.content`/`ReferenceLine.label`
// (renderizados de verdade, como o recharts faz, em vez de virarem `null`).
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="rc">{children}</div>,
  BarChart: ({ data, margin, children }) => (
    <div data-testid="bar-chart" data-margin-right={margin?.right}>
      {data.map((d) => (
        <span key={d.m} data-testid="month-label">
          {d.m}
        </span>
      ))}
      {children}
    </div>
  ),
  Bar: ({ dataKey, children }) => <div data-testid={`bar-${dataKey}`}>{children}</div>,
  Cell: ({ fill, fillOpacity }) => <span data-testid="cell" data-fill={fill} data-fill-opacity={fillOpacity} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: ({ content }) => {
    const payload = [{ payload: TOOLTIP_SAMPLE }];
    return React.isValidElement(content)
      ? React.cloneElement(content, { active: true, payload, label: TOOLTIP_SAMPLE.m })
      : content({ active: true, payload, label: TOOLTIP_SAMPLE.m });
  },
  ReferenceLine: ({ label }) =>
    label ? <div data-testid="reference-line-label">{typeof label === "object" ? label.value : label}</div> : null,
}));

// Ponto do tooltip usado pela renderização fake do Tooltip acima.
// Valores deliberadamente diferentes dos da fixture principal para não colidir
const TOOLTIP_SAMPLE = { m: "Mar", spent: 9999, budget: 15000, current: true };

// Payload como a API realmente manda: `total_expenses`/`budget` chegam como
// Decimal serializado (STRING), não número. Nov é numericamente o maior gasto
// (12000 > 9500) mas "9500.00" > "12000.00" em comparação de string — é
// exatamente o bug de #91 que essa fixture precisa provar corrigido.
const HISTORY_WIRE_6M = [
  { m: "Out", spent: "9500.00", budget: "10000.00" },
  { m: "Nov", spent: "12000.00", budget: "10000.00" },
  { m: "Dez", spent: "7200.00", budget: "8000.00" },
  { m: "Jan", spent: "5800.00", budget: "8000.00" },
  { m: "Fev", spent: "5400.00", budget: "8000.00" },
  { m: "Mar", spent: "4381.00", budget: "8000.00", current: true },
];

const EXPECTED_AVG = HISTORY_WIRE_6M.reduce((s, h) => s + toAmount(h.spent), 0) / HISTORY_WIRE_6M.length;

describe("BudgetHistoryChart (RTL)", () => {
  it("renderiza o gráfico sem cair", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("mostra os 6 meses do histórico no gráfico", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    const labels = screen.getAllByTestId("month-label").map((el) => el.textContent);
    expect(labels).toEqual(["Out", "Nov", "Dez", "Jan", "Fev", "Mar"]);
  });

  it("converte spent/budget vindos como string e soma numericamente (não concatena) na média", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    // Se a soma concatenasse string em vez de somar número, isto não bateria
    // com nenhum texto renderizado (e teria "NaN" em algum lugar da tela).
    expect(screen.getByText(fmtAbs(EXPECTED_AVG))).toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it("identifica o MAIOR gasto por valor numérico, não por comparação de string", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    // Nov = 12000 é o maior; "9500.00" > "12000.00" como string enganaria uma
    // comparação ingênua e apontaria Out.
    expect(screen.getByText(fmtAbs(12000))).toBeInTheDocument();
    expect(screen.getByText("Nov", { selector: "div" })).toBeInTheDocument();
    expect(screen.queryByText(fmtAbs(9500))).not.toBeInTheDocument();
  });

  it("colore as barras por valor numérico: mês atual em azul, acima do limite em vermelho, demais em ink", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    const cells = screen.getAllByTestId("cell");
    expect(cells).toHaveLength(6);
    const fills = cells.map((c) => c.dataset.fill);
    // Out, Dez, Jan, Fev = dentro do limite e não são o mês atual → ink
    // Nov = acima do limite (12000 > 10000) → red
    // Mar = mês atual → blue
    expect(fills).toEqual([T.ink, T.red, T.ink, T.ink, T.ink, T.blue]);
  });

  it("não deixa float bruto no rótulo da média quando ela fica abaixo de mil (fmtK arredonda)", () => {
    const lowValueHistory = [
      { m: "Out", spent: "300.00" },
      { m: "Nov", spent: "500.00" },
      { m: "Dez", spent: "400.00" },
      { m: "Jan", spent: "600.00" },
      { m: "Fev", spent: "450.00" },
      { m: "Mar", spent: "550.00", current: true },
    ];
    render(<BudgetHistoryChart historyData={lowValueHistory} isMobile={false} shouldUseRealData />);
    const avg = lowValueHistory.reduce((s, h) => s + toAmount(h.spent), 0) / lowValueHistory.length; // 466.666...
    expect(screen.getByTestId("reference-line-label")).toHaveTextContent(`Média ${fmtK(avg)}`);
    expect(screen.getByTestId("reference-line-label").textContent).not.toMatch(/\./);
  });

  it("dá margem direita suficiente para o rótulo da média não ser cortado pelo SVG (desktop)", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    const marginRight = Number(screen.getByTestId("bar-chart").dataset.marginRight);
    expect(marginRight).toBeGreaterThanOrEqual(40);
  });

  it("tooltip mostra o valor cheio em BRL e o status dentro/acima do limite do mês", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    expect(screen.getByText(fmtAbs(TOOLTIP_SAMPLE.spent))).toBeInTheDocument();
    expect(screen.getByText(/dentro do limite/i)).toBeInTheDocument();
  });

  it("mostra a legenda completa (Limite, Gasto, Mês atual, Acima do limite)", () => {
    render(<BudgetHistoryChart historyData={HISTORY_WIRE_6M} isMobile={false} shouldUseRealData={false} />);
    expect(screen.getByText("Limite")).toBeInTheDocument();
    expect(screen.getByText("Gasto")).toBeInTheDocument();
    expect(screen.getAllByText("Mês atual").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Acima do limite")).toBeInTheDocument();
  });

  it("indica quando não há histórico suficiente", () => {
    render(<BudgetHistoryChart historyData={[]} isMobile={false} shouldUseRealData />);
    expect(screen.getByText(/não há histórico suficiente/i)).toBeInTheDocument();
  });

  it("mostra o aviso de limite indisponível apenas com dados reais (backend não expõe limite histórico)", () => {
    const realHistory = HISTORY_WIRE_6M.map(({ m, spent, current }) => ({ m, spent, current }));
    render(<BudgetHistoryChart historyData={realHistory} isMobile={false} shouldUseRealData />);
    expect(screen.getByText(/backend ainda não expõe o limite histórico/i)).toBeInTheDocument();
  });
});
