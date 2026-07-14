import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  getAiEvaluationRun: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import {
  evaluateClientWithAi,
  getAiEvaluationRun,
  newEvaluationRequestId,
} from "../../../../api/consultant";
import {
  __resetStore,
  clearAllEvaluations,
  getSlice,
  runEvaluation,
  subscribe,
} from "../clientEvaluationStore.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const REQ_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  summary: "Cliente em atencao.",
  health_read: { score: 61, label: "Atenção", headline: "Renda comprometida." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: [],
};

beforeEach(() => {
  vi.mocked(evaluateClientWithAi).mockReset();
  vi.mocked(getAiEvaluationRun).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
  __resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** O `409` que o backend devolve quando a run daquele cliente já está rodando. */
const inProgress = (runId = RUN_ID) =>
  Object.assign(new Error("HTTP 409"), {
    response: {
      status: 409,
      data: {
        detail: {
          code: "evaluation_in_progress",
          message: "Já existe uma avaliação em andamento para este cliente.",
          run_id: runId,
        },
      },
    },
  });

const httpError = (status) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status } });

/**
 * O store vive fora do React e fora do ciclo de vida da sessão. Isso é o que faz
 * a run sobreviver ao fechamento do painel — e é exatamente o que o faz
 * atravessar o logout se ninguém o limpar. Estes testes trancam a limpeza.
 */
describe("clientEvaluationStore — fim de sessão", () => {
  it("esquece as avaliações: o próximo consultor não herda a análise do anterior", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);
    expect(getSlice(ORG).result).toBeTruthy();

    clearAllEvaluations();

    expect(getSlice(ORG).result).toBeNull();
    expect(getSlice(ORG).computedAt).toBeNull();
  });

  it("uma run em voo no logout NÃO repovoa o store quando a resposta chega", async () => {
    // O furo mais sutil: a avaliação leva de 12 a 50 segundos. Limpar o store no
    // logout não basta — a promessa continua viva, e sem o guard de geração ela
    // escreveria o resultado do consultor que SAIU na memória do que acabou de
    // entrar. O backend nem é consultado: o store serviria o dado direto.
    let entregar;
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise((r) => { entregar = r; }));

    const emVoo = runEvaluation(ORG);
    expect(getSlice(ORG).loading).toBe(true);

    clearAllEvaluations();

    entregar({ output, correlation_id: REQ_ID });
    await emVoo;

    expect(getSlice(ORG).result).toBeNull();
    expect(getSlice(ORG).loading).toBe(false);
  });

  it("uma run em voo que FALHA depois do logout também não escreve o erro", async () => {
    let recusar;
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise((_, r) => { recusar = r; }));

    const emVoo = runEvaluation(ORG);
    clearAllEvaluations();

    recusar(Object.assign(new Error("HTTP 422"), { response: { status: 422 } }));
    await emVoo;

    expect(getSlice(ORG).error).toBe("");
  });

  it("notifica quem está montado, em vez de descartar os listeners", async () => {
    // Descartar os listeners deixaria um drawer aberto surdo: ele continuaria
    // pintando a avaliação do usuário anterior até ser desmontado.
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);

    const avisado = vi.fn();
    subscribe(ORG, avisado);

    clearAllEvaluations();

    expect(avisado).toHaveBeenCalled();
  });

  it("depois da limpeza o store volta a funcionar para o novo usuário", async () => {
    // O guard de geração não pode trancar o store: quem entra depois precisa
    // conseguir avaliar normalmente.
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);
    clearAllEvaluations();

    await runEvaluation(ORG);

    expect(getSlice(ORG).result?.health_read.score).toBe(61);
    expect(evaluateClientWithAi).toHaveBeenCalledTimes(2);
  });
});

/**
 * Reencontrar uma run em andamento.
 *
 * O store guarda a run em voo — mas só dentro DESTA aba e DESTE carregamento da
 * página. Um F5 no meio da avaliação, ou o cliente aberto numa segunda aba,
 * apaga o store e o consultor volta à estaca zero: ele pede a avaliação de novo,
 * e o backend (com razão) recusa com `409 evaluation_in_progress` — a run existe
 * e já está sendo paga. Mostrar "tente de novo" ali seria mandá-lo esperar por
 * uma resposta que já está a caminho. Esse 409 carrega o `run_id`, e é com ele
 * que se volta para a run.
 */
describe("clientEvaluationStore — reencontrar a run (409 evaluation_in_progress)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("o 409 não vira erro na tela: o store acompanha a run e entrega o resultado", async () => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun)
      .mockResolvedValueOnce({ run_id: RUN_ID, correlation_id: REQ_ID, status: "running" })
      .mockResolvedValueOnce({
        run_id: RUN_ID,
        correlation_id: REQ_ID,
        status: "ok",
        output,
        computed_at: "2026-07-14T09:15:00-03:00",
      });

    const emVoo = runEvaluation(ORG);

    // Primeiro poll: ainda rodando. O consultor continua vendo o skeleton — do
    // ponto de vista dele não houve 409 nenhum, só uma avaliação que demorou.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getSlice(ORG).loading).toBe(true);
    expect(getSlice(ORG).error).toBe("");

    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice(ORG).result?.health_read.score).toBe(61);
    expect(getSlice(ORG).loading).toBe(false);
    expect(getSlice(ORG).computedAt).toBe("2026-07-14T09:15:00-03:00");
    // Reencontrada, não servida do cache: a distinção importa na faixa de idade.
    expect(getSlice(ORG).cached).toBe(false);
    // E, acima de tudo: UMA avaliação foi paga, não duas.
    expect(evaluateClientWithAi).toHaveBeenCalledTimes(1);
    expect(getAiEvaluationRun).toHaveBeenCalledWith(ORG, RUN_ID);
  });

  it("enquanto acompanha, reabrir o painel NÃO dispara outra avaliação", async () => {
    // O `inFlight` do cliente segue marcado durante todo o acompanhamento — senão
    // o auto-run do drawer bateria de novo no POST e levaria outro 409.
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockResolvedValue({
      run_id: RUN_ID, correlation_id: REQ_ID, status: "running",
    });

    const emVoo = runEvaluation(ORG);
    await vi.advanceTimersByTimeAsync(3_000);

    await runEvaluation(ORG);
    await runEvaluation(ORG);

    expect(evaluateClientWithAi).toHaveBeenCalledTimes(1);

    clearAllEvaluations(); // encerra o loop de poll
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;
  });

  it("a run reencontrada que termina mal vira a MESMA mensagem de falha do POST", async () => {
    // O consultor não pode ver duas histórias diferentes para a mesma falha só
    // porque uma chegou por HTTP e a outra por `RunStatus`.
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockResolvedValue({
      run_id: RUN_ID, correlation_id: REQ_ID, status: "blocked",
    });

    const emVoo = runEvaluation(ORG);
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice(ORG).result).toBeNull();
    expect(getSlice(ORG).error).toMatch(/não foi possível gerar/i);
  });

  it("run reencontrada em insufficient_data mantém o estado neutro, não o vermelho", async () => {
    // Cliente sem lançamento não é erro — é estado do cliente. O drawer ramifica
    // pelo `errorCode`, então ele tem de sobreviver ao reencontro.
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockResolvedValue({
      run_id: RUN_ID, correlation_id: REQ_ID, status: "insufficient_data",
    });

    const emVoo = runEvaluation(ORG);
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice(ORG).errorCode).toBe("insufficient_data");
    expect(getSlice(ORG).error).toMatch(/ainda não registrou nenhuma transação/i);
  });

  it("um 409 SEM run_id (request-id repetido) continua sendo o erro de sempre", async () => {
    // São dois 409 diferentes: `duplicate_request` (mesmo X-Request-Id) não tem
    // run para reencontrar. Confundi-los faria o store pollar um `undefined`.
    vi.mocked(evaluateClientWithAi).mockRejectedValue(
      Object.assign(new Error("HTTP 409"), {
        response: { status: 409, data: { detail: { code: "duplicate_request" } } },
      })
    );

    await runEvaluation(ORG);

    expect(getSlice(ORG).error).toMatch(/em andamento/i);
    expect(getAiEvaluationRun).not.toHaveBeenCalled();
  });

  it("desiste de acompanhar quando a run passa do tempo em que o backend a enterra", async () => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockResolvedValue({
      run_id: RUN_ID, correlation_id: REQ_ID, status: "running",
    });

    const emVoo = runEvaluation(ORG);
    await vi.advanceTimersByTimeAsync(310_000);
    await emVoo;

    expect(getSlice(ORG).loading).toBe(false);
    expect(getSlice(ORG).error).toMatch(/demorando mais do que o normal/i);
  });

  it("a run enterrada (404) não é confundida com 'cliente fora da carteira'", async () => {
    // O 404 do GET diz que a RUN sumiu; o cliente está na carteira. Reusar a
    // mensagem de 404 do POST mandaria o consultor caçar um problema inexistente.
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockRejectedValue(httpError(404));

    const emVoo = runEvaluation(ORG);
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice(ORG).error).toMatch(/recuperar a avaliação em andamento/i);
    expect(getSlice(ORG).error).not.toMatch(/carteira/i);
  });

  it("sair da conta no meio do acompanhamento não escreve nada no store", async () => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiEvaluationRun).mockResolvedValue({
      run_id: RUN_ID, correlation_id: REQ_ID, status: "ok", output,
    });

    const emVoo = runEvaluation(ORG);
    clearAllEvaluations();

    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice(ORG).result).toBeNull();
  });
});
