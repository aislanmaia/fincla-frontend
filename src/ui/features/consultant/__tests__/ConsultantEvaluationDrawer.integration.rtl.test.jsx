// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testes do drawer com o **hook real** (só a camada de API é mockada).
 *
 * Os testes unitários do drawer mockam `useClientEvaluation`, o que os torna
 * cegos para bugs na interação entre a ordem dos efeitos do hook e a do drawer
 * — foi exatamente assim que o reset de estado sob `<StrictMode>` passou
 * despercebido. Estes exercícios fecham essa lacuna.
 */

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
vi.mock("../../../../api/client", () => ({ handleApiError: vi.fn(() => "erro generico") }));
vi.mock("../AiChart.jsx", () => ({ AiChart: () => null }));

import { evaluateClientWithAi } from "../../../../api/consultant";
import { __resetStore } from "../clientEvaluationStore.js";
import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";

const output = {
  summary: "Resumo do cliente.",
  health_read: { score: 38, label: "Em risco", headline: "Ação imediata." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: ["Apoio ao consultor."],
};

const drawer = (
  <ConsultantEvaluationDrawer open organizationId="org-1" clientName="Rafael Menezes" onClose={() => {}} />
);

beforeEach(() => {
  // O estado das avaliações vive fora do React (por cliente) — sem isto um
  // teste herda a avaliação do anterior.
  __resetStore();
  vi.mocked(evaluateClientWithAi).mockReset();
});
afterEach(() => {
  cleanup();
});

describe("ConsultantEvaluationDrawer + useClientEvaluation (hook real)", () => {
  // O app roda dentro de <StrictMode> (src/main.jsx). Os efeitos rodam duas
  // vezes; o reset do hook está registrado ANTES do auto-run do drawer, então
  // sem guard a segunda passada apagava o `loading` já setado por run() e o
  // corpo do drawer ficava em branco durante a requisição inteira.
  it("keeps the loading skeleton visible under StrictMode while the request is in flight", () => {
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode>{drawer}</StrictMode>);

    expect(screen.getByText(/Analisando dados de Rafael/)).toBeInTheDocument();
  });

  it("fires exactly one request under StrictMode's double-invoked effects", () => {
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise(() => {}));

    render(<StrictMode>{drawer}</StrictMode>);

    expect(evaluateClientWithAi).toHaveBeenCalledTimes(1);
  });

  it("renders the evaluation once the request resolves", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: "corr-1", session_id: "s", run_id: "r", output,
    });

    render(<StrictMode>{drawer}</StrictMode>);

    await waitFor(() => expect(screen.getByText("Ação imediata.")).toBeInTheDocument());
    expect(screen.getByText("Resumo do cliente.")).toBeInTheDocument();
    expect(screen.queryByText(/Analisando dados/)).not.toBeInTheDocument();
  });

  it("surfaces the mapped message when the backend refuses the run", async () => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(
      Object.assign(new Error("402"), { response: { status: 402 } })
    );

    render(<StrictMode>{drawer}</StrictMode>);

    await waitFor(() => expect(screen.getByText("Não foi possível avaliar")).toBeInTheDocument());
    expect(screen.getByText(/limite de uso da IA/i)).toBeInTheDocument();
  });
});
