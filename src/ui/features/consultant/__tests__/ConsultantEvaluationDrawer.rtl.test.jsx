// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";

// `ERROR_INSUFFICIENT_DATA` vem junto: o drawer o importa deste módulo, e um mock
// que só devolve o hook faz o componente explodir na renderização, não na asserção.
vi.mock("../useClientEvaluation.js", () => ({
  useClientEvaluation: vi.fn(),
  ERROR_INSUFFICIENT_DATA: "insufficient_data",
}));
// O <AiChart> tem teste próprio; aqui só interessa que o drawer renderize um por spec.
vi.mock("../AiChart.jsx", () => ({
  AiChart: ({ spec }) => <div data-testid="ai-chart" data-title={spec.title} />,
}));

import { useClientEvaluation } from "../useClientEvaluation.js";

const ORG = "org-1";

// Forma REAL do contrato (fincla-api/src/application/ai/contracts.py):
// watch_points são objetos {metric, note}; ChartSpec tem type/series[].name/kind/color.
const result = {
  summary: "Cliente comprometeu 61% da renda com dívidas.",
  health_read: { score: 38, label: "em risco", headline: "Situação exige ação imediata." },
  action_plan: [
    {
      title: "Renegociar o rotativo do cartão",
      rationale: "O rotativo consome a maior fatia da renda.",
      priority: "high",
      evidence: [{ metric: "income_commitment", value: 0.61, source_tool: "get_client_overview" }],
    },
    {
      title: "Montar reserva de 1 mês",
      rationale: "Sem colchão.",
      priority: "medium",
      evidence: [{ metric: "savings_rate", value: 0.04, source_tool: "get_client_overview" }],
    },
  ],
  watch_points: [
    { metric: "emergency_fund_months", note: "Reserva abaixo de 1 mês" },
    { metric: "income_type", note: "Renda variável" },
  ],
  charts: [
    {
      type: "bar",
      title: "Gastos por categoria",
      x: { key: "label" },
      series: [{ key: "value", name: "Valor", kind: "bar", color: "purple" }],
      data: [{ label: "Moradia", value: 3400 }],
      value_format: "brl0",
    },
  ],
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

  // React 18 StrictMode monta/desmonta os efeitos duas vezes em dev, então o
  // drawer pode PEDIR a avaliação duas vezes. Isso deixou de ser um problema: o
  // `run()` é idempotente por cliente (`clientEvaluationStore`), e é lá que a
  // deduplicação vive agora — antes ela morava num ref do drawer, que morria
  // junto com ele ao fechar o painel e por isso não protegia nada.
  //
  // A garantia que importa — UMA requisição, não duas — é verificada com o hook
  // real em `ConsultantEvaluationDrawer.integration.rtl.test.jsx`. Aqui o hook é
  // mock, então só dá para afirmar que o drawer pede a avaliação ao abrir.
  it("pede a avaliação ao abrir, mesmo sob StrictMode", () => {
    const run = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ run }));
    render(
      <StrictMode>
        <ConsultantEvaluationDrawer open organizationId={ORG} clientName="Rafael" onClose={() => {}} />
      </StrictMode>
    );
    expect(run).toHaveBeenCalled();
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

  // O painel se anuncia como aria-modal; sem Escape ele prende quem navega
  // pelo teclado (e ocupa 92vw no mobile).
  it("closes on Escape", () => {
    const onClose = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result }));
    renderDrawer({ onClose });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops listening for Escape once closed", () => {
    const onClose = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result }));
    const { unmount } = renderDrawer({ onClose });
    unmount();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
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
