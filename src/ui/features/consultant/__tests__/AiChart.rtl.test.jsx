// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiChart } from "../AiChart.jsx";

// Sem setup global de RTL neste repo: cada arquivo limpa o DOM entre testes.
afterEach(cleanup);

// Mesmo padrão dos demais testes de gráfico do repo: recharts não mede nada em
// jsdom. Aqui os stubs registram as props num data-attribute, para afirmar que
// o AiChart escolhe o gráfico certo e mapeia as séries do ChartSpec.
vi.mock("recharts", () => {
  const box = (testid) => ({ children }) => <div data-testid={testid}>{children}</div>;
  const serie = (testid) => (props) => (
    <div data-testid={testid} data-key={props.dataKey} data-name={props.name} data-fill={props.fill} data-stroke={props.stroke} />
  );
  return {
    ResponsiveContainer: box("recharts-rc"),
    BarChart: box("bar-chart"),
    LineChart: box("line-chart"),
    AreaChart: box("area-chart"),
    PieChart: box("pie-chart"),
    Bar: serie("bar"),
    Line: serie("line"),
    Area: serie("area"),
    Pie: ({ children, dataKey, nameKey }) => (
      <div data-testid="pie" data-key={dataKey} data-namekey={nameKey}>{children}</div>
    ),
    Cell: (props) => <div data-testid="cell" data-fill={props.fill} />,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => <div data-testid="legend" />,
    XAxis: (props) => <div data-testid="x-axis" data-key={props.dataKey} />,
    YAxis: () => null,
  };
});

const barSpec = {
  type: "bar",
  title: "Gastos por categoria",
  x: { key: "category", label: "Categoria" },
  series: [{ key: "amount", label: "Valor" }],
  data: [
    { category: "Moradia", amount: 2500 },
    { category: "Alimentação", amount: 1200 },
  ],
};

describe("AiChart", () => {
  it("renders a bar chart with the spec's title, x key and series", () => {
    render(<AiChart spec={barSpec} />);

    expect(screen.getByText("Gastos por categoria")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("x-axis")).toHaveAttribute("data-key", "category");

    const bar = screen.getByTestId("bar");
    expect(bar).toHaveAttribute("data-key", "amount");
    expect(bar).toHaveAttribute("data-name", "Valor");
  });

  it.each([
    ["line", "line-chart", "line"],
    ["area", "area-chart", "area"],
  ])("renders a %s chart for that spec type", (type, chartTestId, serieTestId) => {
    render(<AiChart spec={{ ...barSpec, type }} />);
    expect(screen.getByTestId(chartTestId)).toBeInTheDocument();
    expect(screen.getByTestId(serieTestId)).toHaveAttribute("data-key", "amount");
  });

  it("renders a pie chart with one Cell per data row", () => {
    render(<AiChart spec={{ ...barSpec, type: "pie" }} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("pie")).toHaveAttribute("data-key", "amount");
    expect(screen.getByTestId("pie")).toHaveAttribute("data-namekey", "category");
    expect(screen.getAllByTestId("cell")).toHaveLength(2);
  });

  it("falls back to a bar chart for an unknown type", () => {
    render(<AiChart spec={{ ...barSpec, type: "sankey" }} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("honours an explicit series color and otherwise uses the palette", () => {
    const { rerender } = render(
      <AiChart spec={{ ...barSpec, series: [{ key: "amount", color: "#ff0000" }] }} />
    );
    expect(screen.getByTestId("bar")).toHaveAttribute("data-fill", "#ff0000");

    rerender(<AiChart spec={barSpec} />);
    expect(screen.getByTestId("bar")).toHaveAttribute("data-fill", "#7C3AED"); // T.purple
  });

  it("shows a legend only when the spec has more than one series", () => {
    const { rerender } = render(<AiChart spec={barSpec} />);
    expect(screen.queryByTestId("legend")).not.toBeInTheDocument();

    rerender(
      <AiChart spec={{ ...barSpec, series: [{ key: "amount" }, { key: "budget" }] }} />
    );
    expect(screen.getByTestId("legend")).toBeInTheDocument();
  });

  // Uma spec quebrada não pode derrubar o drawer inteiro.
  it.each([
    ["null spec", null],
    ["no data", { ...barSpec, data: [] }],
    ["no series", { ...barSpec, series: [] }],
    ["no x key", { ...barSpec, x: {} }],
    ["no type", { ...barSpec, type: undefined }],
  ])("degrades gracefully: %s", (_label, spec) => {
    render(<AiChart spec={spec} />);
    expect(screen.getByText("Gráfico indisponível.")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });
});
