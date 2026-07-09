// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";

vi.mock("../useClientEvaluation.js", () => ({ useClientEvaluation: vi.fn() }));
// O <AiChart> tem teste próprio; aqui só interessa que o drawer renderize um por spec.
vi.mock("../AiChart.jsx", () => ({
  AiChart: ({ spec }) => <div data-testid="ai-chart" data-title={spec.title} />,
}));

import { useClientEvaluation } from "../useClientEvaluation.js";

const ORG = "org-1";

const result = {
  summary: "Cliente comprometeu 61% da renda com dívidas.",
  health_read: { score: 38, label: "Em risco", headline: "Situação exige ação imediata." },
  action_plan: [
    {
      title: "Renegociar o rotativo do cartão",
      rationale: "O rotativo consome a maior fatia da renda.",
      priority: "high",
      evidence: [{ metric: "income_commitment", value: 0.61, source_tool: "get_client_overview" }],
    },
    { title: "Montar reserva de 1 mês", rationale: "Sem colchão.", priority: "medium", evidence: [] },
  ],
  watch_points: ["Reserva abaixo de 1 mês", "Renda variável"],
  charts: [{ type: "bar", title: "Gastos por categoria", x: { key: "c" }, series: [{ key: "v" }], data: [{ c: "a", v: 1 }] }],
  disclaimers: ["Análise de apoio ao consultor."],
};

const hookState = (over = {}) => ({
  loading: false,
  error: "",
  result: null,
  correlationId: "",
  run: vi.fn(),
  reset: vi.fn(),
  ...over,
});

const renderDrawer = (props = {}) =>
  render(
    <ConsultantEvaluationDrawer
      open
      organizationId={ORG}
      clientName="Rafael Menezes"
      onClose={() => {}}
      {...props}
    />
  );

beforeEach(() => vi.mocked(useClientEvaluation).mockReset());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ConsultantEvaluationDrawer", () => {
  it("renders nothing when closed", () => {
    vi.mocked(useClientEvaluation).mockReturnValue(hookState());
    const { container } = renderDrawer({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("runs the evaluation when opened", () => {
    const run = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ run }));
    renderDrawer();
    expect(run).toHaveBeenCalledTimes(1);
  });

  // React 18 StrictMode monta/desmonta os efeitos duas vezes em dev. Sem o guard
  // por cliente, isso dispararia DUAS runs de LLM a cada abertura do drawer.
  it("runs only once under StrictMode's double-invoked effects", () => {
    const run = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ run }));
    render(
      <StrictMode>
        <ConsultantEvaluationDrawer open organizationId={ORG} clientName="Rafael" onClose={() => {}} />
      </StrictMode>
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("shows the loading skeleton with the client's first name", () => {
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ loading: true }));
    renderDrawer();
    expect(screen.getByText(/Analisando dados de Rafael/)).toBeInTheDocument();
    expect(screen.queryByText(/Recomendações/)).not.toBeInTheDocument();
  });

  it("renders the full evaluation on success", () => {
    vi.mocked(useClientEvaluation).mockReturnValue(
      hookState({ result, correlationId: "abc-123" })
    );
    renderDrawer();

    // verdict + summary
    expect(screen.getByText("Situação exige ação imediata.")).toBeInTheDocument();
    expect(screen.getByText(/comprometeu 61%/)).toBeInTheDocument();
    // watch points
    expect(screen.getByText("Reserva abaixo de 1 mês")).toBeInTheDocument();
    // action plan + priority + evidence
    expect(screen.getByText("Renegociar o rotativo do cartão")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText(/income_commitment/)).toBeInTheDocument();
    // charts
    expect(screen.getByTestId("ai-chart")).toHaveAttribute("data-title", "Gastos por categoria");
    // disclaimers + traceability
    expect(screen.getByText("Análise de apoio ao consultor.")).toBeInTheDocument();
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });

  it("shows the error state and retries on demand", () => {
    const run = vi.fn();
    const reset = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(
      hookState({ error: "Você atingiu o limite de uso da IA.", run, reset })
    );
    renderDrawer();

    expect(screen.getByText("Não foi possível avaliar")).toBeInTheDocument();
    expect(screen.getByText(/limite de uso da IA/)).toBeInTheDocument();

    run.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reset).toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("hides the footer actions until a result exists", () => {
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ loading: true }));
    const { rerender } = renderDrawer();
    expect(screen.queryByRole("button", { name: /Exportar/ })).not.toBeInTheDocument();

    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result }));
    rerender(
      <ConsultantEvaluationDrawer open organizationId={ORG} clientName="Rafael Menezes" onClose={() => {}} />
    );
    // Trilha B: presentes para preservar o layout da referência, mas desabilitados.
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Enviar ao cliente/ })).toBeDisabled();
  });

  it("closes from the header button", () => {
    const onClose = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result }));
    renderDrawer({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result }));
    renderDrawer({ onClose });

    // O backdrop é o primeiro filho do dialog (irmão do painel).
    const backdrop = screen.getByRole("dialog").firstChild;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not run when there is no organizationId", () => {
    const run = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ run }));
    renderDrawer({ organizationId: undefined });
    expect(run).not.toHaveBeenCalled();
  });
});
