// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "../../../../api/__fixtures__/evaluateClientExample.json";
import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";

/**
 * Teste de **fidelidade de contrato**.
 *
 * `evaluateClientExample.json` é a fixture canônica, cópia byte a byte de
 * `fincla-api/docs/plans/consultant-ai/fixtures/evaluate_client_example.json`,
 * onde um teste do backend afirma que ela valida contra o Pydantic
 * `EvaluateClientOutput`. Se o contrato do backend mudar, a fixture muda, e
 * este teste quebra aqui — que é o ponto.
 *
 * **Por que existe:** a etapa 9 foi construída a partir do `FRONTEND_API_GUIDE`,
 * que havia divergido do contrato real (`watch_points` como `string[]`,
 * `ChartSpec.type: "pie"`, `series[].label`). O drawer quebrava com
 * "Objects are not valid as a React child" na primeira resposta de verdade.
 * Nenhum teste pegou porque todos usavam fixtures inventadas à mão.
 *
 * Recharts fica stubbado: aqui interessa a tradução do contrato, não o desenho.
 */

vi.mock("recharts", () => {
  const box = (testid) => ({ children }) => <div data-testid={testid}>{children}</div>;
  const noop = () => null;
  return {
    ResponsiveContainer: box("recharts-rc"),
    ComposedChart: box("composed-chart"),
    LineChart: box("line-chart"),
    PieChart: box("pie-chart"),
    Pie: ({ children }) => <div data-testid="pie">{children}</div>,
    Cell: () => <div data-testid="cell" />,
    Bar: noop, Line: noop, Area: noop,
    CartesianGrid: noop, Tooltip: noop, Legend: noop, XAxis: noop, YAxis: noop,
  };
});

vi.mock("../useClientEvaluation.js", () => ({ useClientEvaluation: vi.fn() }));
import { useClientEvaluation } from "../useClientEvaluation.js";

beforeEach(() => {
  vi.mocked(useClientEvaluation).mockReturnValue({
    loading: false,
    error: "",
    result: fixture,
    correlationId: "corr-123",
    run: vi.fn(),
    reset: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantEvaluationDrawer — fidelidade ao contrato do backend", () => {
  const renderDrawer = () =>
    render(
      <ConsultantEvaluationDrawer open organizationId="org-1" clientName="Rafael Menezes" onClose={() => {}} />
    );

  it("renders the canonical payload without throwing", () => {
    expect(() => renderDrawer()).not.toThrow();
  });

  it("renders health_read, summary and disclaimers", () => {
    renderDrawer();
    expect(screen.getByText(fixture.health_read.headline)).toBeInTheDocument();
    expect(screen.getByText(fixture.health_read.label)).toBeInTheDocument();
    expect(screen.getByText(fixture.summary)).toBeInTheDocument();
    expect(screen.getByText(fixture.disclaimers[0])).toBeInTheDocument();
  });

  // A regressão concreta: watch_points são objetos {metric, note}.
  it("renders each watch_point's note (they are objects, not strings)", () => {
    renderDrawer();
    for (const wp of fixture.watch_points) {
      expect(screen.getByText(wp.note)).toBeInTheDocument();
      expect(screen.getByText(`(${wp.metric})`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it("renders every action_plan item with its priority badge and evidence", () => {
    renderDrawer();
    expect(screen.getByText("Renegociar o rotativo do cartão")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("Média")).toBeInTheDocument();
    // Evidência é o que separa análise de chute — precisa aparecer.
    // `income_commitment` aparece 2x de propósito: como evidência e como watch_point.
    expect(screen.getAllByText(/income_commitment/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/card_debt_total/)).toBeInTheDocument();
  });

  it("renders one chart per ChartSpec, picking the renderer from `type`", () => {
    renderDrawer();
    expect(screen.getByText("Para onde vai o dinheiro")).toBeInTheDocument();
    expect(screen.getByText("Receita, despesa e saldo")).toBeInTheDocument();
    // donut -> PieChart, composed -> ComposedChart
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
    expect(screen.queryByText("Gráfico indisponível.")).not.toBeInTheDocument();
  });

  it("shows the correlation id for support tracing", () => {
    renderDrawer();
    expect(screen.getByText(/corr-123/)).toBeInTheDocument();
  });
});
