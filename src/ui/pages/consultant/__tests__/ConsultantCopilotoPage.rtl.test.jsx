// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Copiloto IA (A4) — a página do chat com o store e o hook REAIS; só a API, o
 * gate e o hook de clientes são mockados. Cobre o que importa na tela: o gate
 * (teaser vs. chat), o estado vazio com quick-prompts, e o ciclo enviar → resposta
 * renderizada (markdown + chip de cliente).
 */

const canUse = vi.fn(() => true);
vi.mock("../../../features/consultant/consultantAiAccess.js", () => ({
  useCanUseCopilotoAi: () => canUse(),
}));
vi.mock("../../../features/consultant/useConsultantClients", () => ({
  useConsultantClients: () => ({
    clients: [{ organization_id: "o1", client_name: "Mariana Costa" }],
    total: 1,
    isLoading: false,
  }),
}));
vi.mock("../../../../api/consultant", () => ({
  askCopiloto: vi.fn(),
  getAiCopilotoRun: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));
vi.mock("../../../../api/client", () => ({ handleApiError: vi.fn(() => "erro generico") }));

// Stub do drawer da A1: renderiza só o `clientName` recebido, para provarmos que
// o NOME RESOLVIDO (não o rótulo do botão) chega até ele.
vi.mock("../../../features/consultant/ConsultantEvaluationDrawer.jsx", () => ({
  ConsultantEvaluationDrawer: ({ clientName }) => <div data-testid="eval-drawer">{clientName}</div>,
}));

import { askCopiloto } from "../../../../api/consultant";
import { __resetStore } from "../../../features/consultant/copilotoStore.js";
import { ConsultantCopilotoPage } from "../ConsultantCopilotoPage.jsx";

const output = {
  answer: "Um cliente está em risco: **Mariana C.**\n\n- saúde 20\n- saldo negativo",
  blocks: [{ type: "client_ref", organization_id: "o1", client_name: "Mariana C." }],
  suggested_actions: [],
  disclaimers: ["Apoio ao consultor, não é recomendação de investimento."],
};

beforeEach(() => {
  __resetStore();
  canUse.mockReturnValue(true);
  vi.mocked(askCopiloto).mockReset();
});
afterEach(() => cleanup());

describe("ConsultantCopilotoPage", () => {
  it("mostra o teaser de upgrade e nenhum composer quando o plano não tem o recurso", () => {
    canUse.mockReturnValue(false);

    render(<ConsultantCopilotoPage />);

    expect(screen.getByText(/Disponível no plano Pro/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mensagem para o Copiloto")).not.toBeInTheDocument();
  });

  it("mostra o estado vazio com quick-prompts quando entitled", () => {
    render(<ConsultantCopilotoPage />);

    expect(screen.getByText(/Como posso ajudar com sua carteira/)).toBeInTheDocument();
    expect(screen.getByText("Quais clientes estão em risco e por quê?")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem para o Copiloto")).toBeInTheDocument();
  });

  it("envia uma mensagem e renderiza a resposta (markdown em negrito + chip do cliente)", async () => {
    const user = userEvent.setup();
    vi.mocked(askCopiloto).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r", output,
    });

    render(<ConsultantCopilotoPage />);
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "quem está em risco?");
    await user.click(screen.getByLabelText("Enviar mensagem"));

    // A bolha do usuário aparece.
    expect(screen.getByText("quem está em risco?")).toBeInTheDocument();
    // A resposta da IA é renderizada.
    await waitFor(() => expect(screen.getByText(/Um cliente está em risco/)).toBeInTheDocument());
    // "Mariana C." aparece em DOIS lugares: o negrito do markdown (<strong>) e o
    // chip client_ref (dentro de um <button>). Ambos têm de existir.
    const mentions = screen.getAllByText("Mariana C.");
    expect(mentions.some((el) => el.tagName === "STRONG")).toBe(true);
    expect(mentions.some((el) => el.closest("button"))).toBe(true);
    // O disclaimer é mostrado.
    expect(screen.getByText(/não é recomendação de investimento/)).toBeInTheDocument();
  });

  it("um hand-off resolve o NOME real do cliente pela carteira, não o rótulo do botão", async () => {
    const user = userEvent.setup();
    // O rótulo é copy de botão ("Avaliar Ana com IA"), NÃO o nome. Se ele vazasse
    // como client_name, o drawer da A1 abriria saudando "Avaliar".
    vi.mocked(askCopiloto).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r",
      output: {
        answer: "Recomendo avaliar.",
        blocks: [],
        suggested_actions: [{ label: "Avaliar Ana com IA", skill: "evaluate-client", organization_id: "o1" }],
        disclaimers: ["d"],
      },
    });

    render(<ConsultantCopilotoPage />);
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "quem avaliar?");
    await user.click(screen.getByLabelText("Enviar mensagem"));

    const button = await screen.findByRole("button", { name: /Avaliar Ana com IA/ });
    await user.click(button);

    const drawer = screen.getByTestId("eval-drawer");
    // Resolvido pela carteira (org o1 → "Mariana Costa"), não o rótulo do botão.
    expect(drawer).toHaveTextContent("Mariana Costa");
    expect(drawer).not.toHaveTextContent("Avaliar Ana com IA");
  });

  it("o escopo por cliente injeta o nome na mensagem enviada (âncora de PII)", async () => {
    const user = userEvent.setup();
    vi.mocked(askCopiloto).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r", output,
    });

    render(<ConsultantCopilotoPage />);
    await user.selectOptions(screen.getByLabelText("Escopo da conversa"), "o1");
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "como está?");
    await user.click(screen.getByLabelText("Enviar mensagem"));

    await waitFor(() => expect(askCopiloto).toHaveBeenCalled());
    const sentMessage = vi.mocked(askCopiloto).mock.calls[0][1];
    expect(sentMessage).toContain("Mariana Costa");
  });

  it("renderiza cabeçalhos markdown e tabelas (não como texto cru)", async () => {
    const user = userEvent.setup();
    vi.mocked(askCopiloto).mockResolvedValue({
      correlation_id: "c", session_id: "s", run_id: "r",
      output: {
        answer:
          "### Fluxo de Caixa\n| Mês | Renda | Saldo |\n|------|-------|-------|\n| jul/26 | R$ 5.500 | R$ 650 |\n| ago/26 | R$ 5.200 | -R$ 300 |",
        blocks: [],
        suggested_actions: [],
        disclaimers: ["d"],
      },
    });

    render(<ConsultantCopilotoPage />);
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "fluxo?");
    await user.click(screen.getByLabelText("Enviar mensagem"));

    // Cabeçalho renderiza SEM o `###` cru.
    const heading = await screen.findByText("Fluxo de Caixa");
    expect(heading).toBeInTheDocument();
    expect(screen.queryByText(/### Fluxo/)).not.toBeInTheDocument();
    // Vira uma <table> de verdade com as células, não o `| Mês |` cru.
    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    expect(table).toHaveTextContent("Mês");
    expect(table).toHaveTextContent("jul/26");
    expect(table).toHaveTextContent("-R$ 300");
    expect(screen.queryByText(/\|------\|/)).not.toBeInTheDocument();
  });
});
