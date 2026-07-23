// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Seção "Tendências detectadas pela IA" (A3) com o hook e o store REAIS — só a
 * API é mockada. O ponto crítico desta feature é o AUTO-FIRE ao montar: sob
 * StrictMode o efeito roda duas vezes, e o guard de in-flight tem de garantir
 * UMA requisição (o bug da etapa 9 do A1 era exatamente esse).
 */

vi.mock("../../../../api/consultant", () => ({
  detectPortfolioTrendsWithAi: vi.fn(),
  getAiPortfolioTrendsRun: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
vi.mock("../../../../api/client", () => ({ handleApiError: vi.fn(() => "erro generico") }));

import { detectPortfolioTrendsWithAi } from "../../../../api/consultant";
import { __resetStore } from "../portfolioTrendsStore.js";
import { ConsultantTrendsSection } from "../ConsultantTrendsSection.jsx";

const output = {
  trends: [
    {
      tone: "risk",
      title: "Muitos clientes com alta dívida",
      description: "Card debt agregado alto.",
      evidence: [{ metric: "card_debt", value: 20659.65, source_tool: "get_portfolio_aggregates" }],
    },
    {
      tone: "opportunity",
      title: "Janela para investimentos",
      description: "Dois clientes com folga.",
      evidence: [{ metric: "clients_count", value: 10, source_tool: "get_portfolio_aggregates" }],
    },
  ],
  disclaimers: ["Apoio ao consultor."],
};

beforeEach(() => {
  __resetStore();
  vi.mocked(detectPortfolioTrendsWithAi).mockReset();
});
afterEach(() => {
  cleanup();
});

describe("ConsultantTrendsSection + usePortfolioTrends (hook real)", () => {
  it("auto-dispara ao montar e mostra o skeleton enquanto a requisição está em voo", () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode><ConsultantTrendsSection /></StrictMode>);

    expect(screen.getByText(/Lendo os números de toda a carteira/)).toBeInTheDocument();
  });

  it("dispara exatamente UMA requisição sob os efeitos dobrados do StrictMode", () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode><ConsultantTrendsSection /></StrictMode>);

    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(1);
  });

  it("renderiza os cards de tendência quando a requisição resolve", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r", output,
    });

    render(<StrictMode><ConsultantTrendsSection /></StrictMode>);

    await waitFor(() =>
      expect(screen.getByText("Muitos clientes com alta dívida")).toBeInTheDocument()
    );
    expect(screen.getByText("Janela para investimentos")).toBeInTheDocument();
    // Contagem dinâmica: aqui vieram 2, e a seção mostra 2 (não força 3).
    expect(screen.queryByText(/Lendo os números/)).not.toBeInTheDocument();
    // O "Atualizar" aparece com resultado na tela.
    expect(screen.getByText("Atualizar")).toBeInTheDocument();
  });

  it("carteira sem clientes mostra o estado neutro, não o vermelho", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(
      Object.assign(new Error("422"), {
        response: { status: 422, data: { detail: { code: "insufficient_data", message: "x" } } },
      })
    );

    render(<StrictMode><ConsultantTrendsSection /></StrictMode>);

    await waitFor(() =>
      expect(screen.getByText(/ainda não tem clientes na carteira/i)).toBeInTheDocument()
    );
    expect(screen.queryByText("Tentar novamente")).not.toBeInTheDocument();
  });

  it("uma falha de geração mostra a mensagem e um Tentar novamente", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(
      Object.assign(new Error("402"), { response: { status: 402 } })
    );

    render(<StrictMode><ConsultantTrendsSection /></StrictMode>);

    await waitFor(() =>
      expect(screen.getByText("Não foi possível detectar tendências")).toBeInTheDocument()
    );
    expect(screen.getByText(/limite de uso da IA/i)).toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });
});
