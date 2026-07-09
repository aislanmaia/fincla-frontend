// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiChart } from "../AiChart.jsx";

// Sem setup global de RTL neste repo: cada arquivo limpa o DOM entre testes.
afterEach(cleanup);

// Mesmo padrão dos demais testes de gráfico do repo: recharts não mede nada em
// jsdom. Os stubs registram as props num data-attribute, para afirmar que o
// AiChart escolhe o gráfico certo e traduz o ChartSpec corretamente.
vi.mock("recharts", () => {
  const box = (testid) => ({ children }) => <div data-testid={testid}>{children}</div>;
  const serie = (testid) => (props) => (
    <div data-testid={testid} data-key={props.dataKey} data-name={props.name}
      data-fill={props.fill} data-stroke={props.stroke} />
  );
  return {
    ResponsiveContainer: box("recharts-rc"),
    ComposedChart: box("composed-chart"),
    LineChart: box("line-chart"),
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

/** Forma REAL de `ChartSpec` (fincla-api/src/application/ai/contracts.py). */
const barSpec = {
  type: "bar",
  title: "Gastos por categoria",
  x: { key: "label" },
  series: [{ key: "value", name: "Valor", kind: "bar", color: "purple" }],
  data: [
    { label: "Moradia", value: 3400 },
    { label: "Alimentação", value: 2100 },
  ],
  value_format: "brl0",
};

describe("AiChart", () => {
  it("renders a bar chart with the spec's title, x key and series name", () => {
    render(<AiChart spec={barSpec} />);

    expect(screen.getByText("Gastos por categoria")).toBeInTheDocument();
    expect(screen.getByTestId("x-axis")).toHaveAttribute("data-key", "label");

    const bar = screen.getByTestId("bar");
    expect(bar).toHaveAttribute("data-key", "value");
    // `name`, não `label` — o contrato chama o rótulo de legenda de `name`.
    expect(bar).toHaveAttribute("data-name", "Valor");
  });

  it("maps a color token to the design-system palette, never passing the token through", () => {
    render(<AiChart spec={barSpec} />);
    expect(screen.getByTestId("bar")).toHaveAttribute("data-fill", "#7C3AED"); // T.purple
  });

  // "ink" não é uma cor CSS válida: passar o token direto ao recharts pintaria
  // a série de preto (ou nada). Precisa virar T.ink.
  it("maps the 'ink' token, which is not a valid CSS color on its own", () => {
    render(
      <AiChart
        spec={{ ...barSpec, type: "composed", series: [{ key: "value", name: "Saldo", kind: "line", color: "ink" }] }}
      />
    );
    expect(screen.getByTestId("line")).toHaveAttribute("data-stroke", "#0F0F0D"); // T.ink
  });

  it("renders a line chart for type=line", () => {
    render(<AiChart spec={{ ...barSpec, type: "line" }} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("line")).toHaveAttribute("data-key", "value");
  });

  it("renders a donut with one Cell per data row", () => {
    render(<AiChart spec={{ ...barSpec, type: "donut" }} />);
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("pie")).toHaveAttribute("data-key", "value");
    expect(screen.getByTestId("pie")).toHaveAttribute("data-namekey", "label");
    expect(screen.getAllByTestId("cell")).toHaveLength(2);
  });

  // O ponto do `composed`: cada série honra o seu próprio `kind`.
  it("renders a composed chart honouring each series' kind", () => {
    render(
      <AiChart
        spec={{
          ...barSpec,
          type: "composed",
          series: [
            { key: "income", name: "Receita", kind: "bar", color: "green" },
            { key: "expense", name: "Despesa", kind: "bar", color: "red" },
            { key: "balance", name: "Saldo", kind: "line", color: "ink" },
          ],
          data: [{ label: "abr", income: 10, expense: 8, balance: 2 }],
        }}
      />
    );

    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("bar")).toHaveLength(2);
    const line = screen.getByTestId("line");
    expect(line).toHaveAttribute("data-key", "balance");
    expect(line).toHaveAttribute("data-stroke", "#0F0F0D");
    expect(screen.getByTestId("legend")).toBeInTheDocument();
  });

  it("shows a legend only when the spec has more than one series", () => {
    render(<AiChart spec={barSpec} />);
    expect(screen.queryByTestId("legend")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("composed-chart")).not.toBeInTheDocument();
  });
});
