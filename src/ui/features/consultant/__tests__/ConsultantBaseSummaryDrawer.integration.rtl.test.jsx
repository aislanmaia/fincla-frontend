// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drawer "Resumo da base por IA" (A2) com o **hook e o store reais** — só a API é
 * mockada. É a lição das etapas 8/9 do backend levada ao FE: mockar o hook
 * esconde bugs na interação entre a ordem dos efeitos e o auto-run sob
 * `<StrictMode>`. Estes exercícios atravessam a camada de verdade.
 */

vi.mock("../../../../api/consultant", () => ({
  summarizePortfolioWithAi: vi.fn(),
  getAiPortfolioSummaryRun: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
vi.mock("../../../../api/client", () => ({ handleApiError: vi.fn(() => "erro generico") }));
vi.mock("../AiChart.jsx", () => ({ AiChart: () => null }));

import { summarizePortfolioWithAi } from "../../../../api/consultant";
import { __resetStore } from "../portfolioSummaryStore.js";
import { ConsultantBaseSummaryDrawer } from "../ConsultantBaseSummaryDrawer.jsx";

const output = {
  summary: "Base com 10 clientes.",
  portfolio_read: {
    client_count: 10,
    avg_health: 57.3,
    clients_scored: 3,
    clients_pending: 7,
    at_risk_count: 1,
  },
  priorities: [
    {
      organization_id: "org-ana",
      client_name: "Ana P.",
      note: "Saldo negativo.",
      evidence: [{ metric: "health", value: 20, source_tool: "query_clients" }],
    },
  ],
  opportunities: [
    { note: "3 clientes prontos para investir.", evidence: [] },
  ],
  charts: [],
  disclaimers: ["Apoio ao consultor."],
};

function drawer(props = {}) {
  return <ConsultantBaseSummaryDrawer open onClose={() => {}} {...props} />;
}

beforeEach(() => {
  __resetStore();
  vi.mocked(summarizePortfolioWithAi).mockReset();
});
afterEach(() => {
  cleanup();
});

describe("ConsultantBaseSummaryDrawer + usePortfolioSummary (hook real)", () => {
  it("mantém o skeleton visível sob StrictMode enquanto a requisição está em voo", () => {
    vi.mocked(summarizePortfolioWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode>{drawer()}</StrictMode>);

    expect(screen.getByText(/Lendo os números de toda a sua carteira/)).toBeInTheDocument();
  });

  it("dispara exatamente UMA requisição sob os efeitos dobrados do StrictMode", () => {
    vi.mocked(summarizePortfolioWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode>{drawer()}</StrictMode>);

    expect(summarizePortfolioWithAi).toHaveBeenCalledTimes(1);
  });

  it("renderiza o relatório quando a requisição resolve", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({
      correlation_id: "corr-1", session_id: "s", run_id: "r", output,
    });

    render(<StrictMode>{drawer()}</StrictMode>);

    await waitFor(() => expect(screen.getByText("Base com 10 clientes.")).toBeInTheDocument());
    // Os números da base e a prioridade nomeada aparecem.
    expect(screen.getByText("Ana P.")).toBeInTheDocument();
    expect(screen.getByText("3 clientes prontos para investir.")).toBeInTheDocument();
    expect(screen.queryByText(/Lendo os números/)).not.toBeInTheDocument();
  });

  it("carteira sem clientes mostra o estado neutro, não o vermelho", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(
      Object.assign(new Error("422"), {
        response: { status: 422, data: { detail: { code: "insufficient_data", message: "x" } } },
      })
    );

    render(<StrictMode>{drawer()}</StrictMode>);

    await waitFor(() =>
      expect(screen.getByText(/Ainda não há carteira para analisar/)).toBeInTheDocument()
    );
    // Estado neutro não oferece "Tentar novamente" — a saída é adicionar clientes.
    expect(screen.queryByText("Tentar novamente")).not.toBeInTheDocument();
  });

  it("uma falha de geração mostra a mensagem mapeada e permite tentar de novo", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(
      Object.assign(new Error("402"), { response: { status: 402 } })
    );

    render(<StrictMode>{drawer()}</StrictMode>);

    await waitFor(() =>
      expect(screen.getByText("Não foi possível gerar o relatório")).toBeInTheDocument()
    );
    expect(screen.getByText(/limite de uso da IA/i)).toBeInTheDocument();
  });

  it("formata valores de evidência boolean/null sem vazar 'true'/'null' em inglês", async () => {
    // O contrato permite `bool|null` em `EvidenceItem.value`; sem tratar, um
    // `String(true)` mostraria "true" e `String(null)` mostraria "null" num chip.
    const withEdgeEvidence = {
      ...output,
      priorities: [],
      opportunities: [
        {
          note: "Cliente com reserva formada.",
          evidence: [
            { metric: "tem_reserva", value: true, source_tool: "query_clients" },
            { metric: "score_pendente", value: null, source_tool: "query_clients" },
          ],
        },
      ],
    };
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r", output: withEdgeEvidence,
    });

    render(<StrictMode>{drawer()}</StrictMode>);

    await waitFor(() => expect(screen.getByText("Cliente com reserva formada.")).toBeInTheDocument());
    expect(screen.getByText(/tem_reserva: sim/)).toBeInTheDocument();
    expect(screen.getByText(/score_pendente: —/)).toBeInTheDocument();
    expect(screen.queryByText(/: true/)).not.toBeInTheDocument();
    expect(screen.queryByText(/: null/)).not.toBeInTheDocument();
  });

  it("clicar numa prioridade linka para o cliente pelo organization_id e fecha o drawer", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({
      correlation_id: "corr-1", session_id: "s", run_id: "r", output,
    });
    const onOpenClient = vi.fn();
    const onClose = vi.fn();

    render(<StrictMode>{drawer({ onOpenClient, onClose })}</StrictMode>);

    await waitFor(() => expect(screen.getByText("Ana P.")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Ana P."));

    // O card do Painel linka pelo id real — nome minimizado não identifica ninguém.
    expect(onOpenClient).toHaveBeenCalledWith("org-ana");
    // Fecha antes de navegar: senão o backdrop prenderia a tela de destino.
    expect(onClose).toHaveBeenCalled();
  });
});
