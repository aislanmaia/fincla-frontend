import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  askCopiloto: vi.fn(),
  getAiCopilotoRun: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import {
  askCopiloto,
  getAiCopilotoRun,
  newEvaluationRequestId,
} from "../../../../api/consultant";
import {
  __resetStore,
  getSnapshot,
  newConversation,
  sendMessage,
} from "../copilotoStore.js";

const REQ_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  answer: "Um cliente está em risco.",
  blocks: [{ type: "client_ref", organization_id: "o1", client_name: "Ana P. S." }],
  suggested_actions: [],
  disclaimers: ["Apoio ao consultor."],
};

const okResponse = {
  correlation_id: REQ_ID,
  session_id: "consultant-ai:u:copiloto:t",
  run_id: REQ_ID,
  output,
};

const httpError = (status, detail) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: detail ? { detail } : {} },
  });

beforeEach(() => {
  vi.mocked(askCopiloto).mockReset();
  vi.mocked(getAiCopilotoRun).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
  __resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("copilotoStore — envio", () => {
  it("anexa a mensagem do usuário e depois a resposta da IA", async () => {
    vi.mocked(askCopiloto).mockResolvedValue(okResponse);

    await sendMessage("quem está em risco?");

    const { messages, sending } = getSnapshot();
    expect(sending).toBe(false);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", text: "quem está em risco?" });
    expect(messages[1]).toMatchObject({ role: "assistant", output });
  });

  it("reenvia o MESMO session_id (thread) em mensagens da mesma conversa", async () => {
    vi.mocked(askCopiloto).mockResolvedValue(okResponse);

    await sendMessage("primeira");
    const firstThread = vi.mocked(askCopiloto).mock.calls[0][2];
    await sendMessage("segunda");
    const secondThread = vi.mocked(askCopiloto).mock.calls[1][2];

    expect(firstThread).toBe(secondThread);
  });

  it("ancora o filtro por nome: o escopo injeta o nome do cliente na mensagem enviada", async () => {
    vi.mocked(askCopiloto).mockResolvedValue(okResponse);

    await sendMessage("como está?", { scopeClientName: "Mariana Costa" });

    const sentMessage = vi.mocked(askCopiloto).mock.calls[0][1];
    expect(sentMessage).toContain("Mariana Costa");
    // A bolha na tela mostra o texto CRU, sem o prefixo de escopo.
    expect(getSnapshot().messages[0].text).toBe("como está?");
  });

  it("guarda contra duplo-envio enquanto uma resposta está em voo", async () => {
    let resolve;
    vi.mocked(askCopiloto).mockReturnValue(new Promise((r) => { resolve = r; }));

    const first = sendMessage("uma");
    await sendMessage("duas"); // deve ser ignorada: já está enviando
    resolve(okResponse);
    await first;

    // Só a primeira pergunta virou par (user + assistant); a segunda foi barrada.
    const { messages } = getSnapshot();
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(vi.mocked(askCopiloto)).toHaveBeenCalledTimes(1);
  });
});

describe("copilotoStore — falhas nunca destroem a conversa", () => {
  it("uma falha de geração vira bolha de erro anexada, preservando o histórico", async () => {
    vi.mocked(askCopiloto).mockResolvedValueOnce(okResponse).mockRejectedValueOnce(httpError(422));

    await sendMessage("primeira");
    await sendMessage("segunda");

    const { messages } = getSnapshot();
    // user1, assistant(ok), user2, assistant(erro) — nada foi perdido.
    expect(messages).toHaveLength(4);
    expect(messages[1]).toMatchObject({ role: "assistant", output });
    expect(messages[3]).toHaveProperty("error");
    expect(messages[3].output).toBeUndefined();
  });

  it("o 429 de quota vira um banner (é sobre a CONTA), não uma bolha", async () => {
    vi.mocked(askCopiloto).mockRejectedValue(httpError(429));

    await sendMessage("oi");

    const { messages, banner } = getSnapshot();
    expect(banner).toMatchObject({ code: "429" });
    // A pergunta do usuário fica; nenhuma bolha de resposta é criada.
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("um 409 in-progress reencontra a run pelo run_id (rejoin) e anexa a resposta", async () => {
    vi.mocked(askCopiloto).mockRejectedValue(
      httpError(409, { code: "copilot_in_progress", run_id: RUN_ID, message: "x" })
    );
    vi.mocked(getAiCopilotoRun).mockResolvedValue({ status: "ok", output, correlation_id: RUN_ID });
    vi.useFakeTimers();

    const promise = sendMessage("oi");
    await vi.runAllTimersAsync();
    await promise;
    vi.useRealTimers();

    const { messages } = getSnapshot();
    expect(vi.mocked(getAiCopilotoRun)).toHaveBeenCalledWith(RUN_ID);
    expect(messages.at(-1)).toMatchObject({ role: "assistant", output });
  });
});

describe("copilotoStore — nova conversa", () => {
  it("zera as mensagens e troca o thread", async () => {
    vi.mocked(askCopiloto).mockResolvedValue(okResponse);
    await sendMessage("primeira");
    const oldThread = vi.mocked(askCopiloto).mock.calls[0][2];

    vi.mocked(newEvaluationRequestId).mockReturnValue("44444444-4444-4444-8444-444444444444");
    newConversation();

    expect(getSnapshot().messages).toHaveLength(0);

    await sendMessage("nova");
    const newThread = vi.mocked(askCopiloto).mock.calls[1][2];
    expect(newThread).not.toBe(oldThread);
  });
});
