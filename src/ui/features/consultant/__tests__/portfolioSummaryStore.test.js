import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  summarizePortfolioWithAi: vi.fn(),
  getAiPortfolioSummaryRun: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import {
  getAiPortfolioSummaryRun,
  newEvaluationRequestId,
  summarizePortfolioWithAi,
} from "../../../../api/consultant";
import {
  __resetStore,
  clearAllPortfolioSummaries,
  getSlice,
  runPortfolioSummary,
  subscribe,
} from "../portfolioSummaryStore.js";

const REQ_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  summary: "Base com 10 clientes, saude media 57.",
  portfolio_read: {
    client_count: 10,
    avg_health: 57.3,
    clients_scored: 3,
    clients_pending: 7,
    at_risk_count: 1,
  },
  priorities: [
    {
      organization_id: "org-1",
      client_name: "Ana P.",
      note: "Saldo negativo.",
      evidence: [{ metric: "health", value: 20, source_tool: "query_clients" }],
    },
  ],
  opportunities: [],
  charts: [],
  disclaimers: ["Analise de apoio ao consultor."],
};

beforeEach(() => {
  vi.mocked(summarizePortfolioWithAi).mockReset();
  vi.mocked(getAiPortfolioSummaryRun).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
  __resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** O `409` que o backend devolve quando o relatório da base já está rodando. */
const inProgress = (runId = RUN_ID) =>
  Object.assign(new Error("HTTP 409"), {
    response: {
      status: 409,
      data: {
        detail: {
          code: "portfolio_summary_in_progress",
          message: "Já existe um relatório da base em andamento.",
          run_id: runId,
        },
      },
    },
  });

const httpError = (status, detail) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: detail ? { detail } : {} },
  });

describe("portfolioSummaryStore — execução", () => {
  it("run() bem-sucedida entrega o output e data o resultado", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioSummary();

    const slice = getSlice();
    expect(slice.result?.portfolio_read.client_count).toBe(10);
    expect(slice.loading).toBe(false);
    expect(slice.correlationId).toBe(REQ_ID);
    // Run nova sem `computed_at` do backend é datada aqui — senão o consultor
    // olharia um relatório de horas atrás sem a faixa de idade.
    expect(slice.computedAt).toBeTruthy();
    expect(slice.cached).toBe(false);
  });

  it("é idempotente: um segundo run() não paga outro relatório", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioSummary();
    await runPortfolioSummary();

    expect(summarizePortfolioWithAi).toHaveBeenCalledTimes(1);
  });

  it("refresh fura a idempotência e força uma execução nova", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioSummary();
    await runPortfolioSummary({ refresh: true });

    expect(summarizePortfolioWithAi).toHaveBeenCalledTimes(2);
    // O segundo argumento (`refresh`) tem de chegar `true`.
    expect(summarizePortfolioWithAi).toHaveBeenLastCalledWith(REQ_ID, true);
  });

  it("um refresh que FALHA não apaga o relatório que já estava na tela", async () => {
    vi.mocked(summarizePortfolioWithAi)
      .mockResolvedValueOnce({ output, correlation_id: REQ_ID })
      .mockRejectedValueOnce(httpError(422));

    await runPortfolioSummary();
    await runPortfolioSummary({ refresh: true });

    const slice = getSlice();
    // O resultado anterior sobrevive; o erro vira aviso, não tela vermelha.
    expect(slice.result?.portfolio_read.client_count).toBe(10);
    expect(slice.error).toMatch(/não foi possível gerar o relatório/i);
  });

  it("carteira sem clientes vira estado neutro (insufficient_data), não erro genérico", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(
      httpError(422, { code: "insufficient_data", message: "sem clientes" })
    );

    await runPortfolioSummary();

    const slice = getSlice();
    expect(slice.errorCode).toBe("insufficient_data");
    expect(slice.error).toMatch(/ainda não tem clientes na carteira/i);
    expect(slice.result).toBeNull();
  });

  it("429 (cota mensal) fala de RELATÓRIOS, não de avaliações", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(httpError(429));

    await runPortfolioSummary();

    expect(getSlice().error).toMatch(/relatórios da base/i);
  });

  it("403 fala do relatório da base, não da avaliação de cliente", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(httpError(403));

    await runPortfolioSummary();

    expect(getSlice().error).toMatch(/relatório da base/i);
  });
});

describe("portfolioSummaryStore — fim de sessão", () => {
  it("esquece o relatório: o próximo consultor não herda o do anterior", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runPortfolioSummary();
    expect(getSlice().result).not.toBeNull();

    clearAllPortfolioSummaries();

    expect(getSlice().result).toBeNull();
  });

  it("uma run em voo no logout NÃO repovoa o store quando a resposta chega", async () => {
    let entregar;
    vi.mocked(summarizePortfolioWithAi).mockReturnValue(
      new Promise((r) => {
        entregar = r;
      })
    );

    const emVoo = runPortfolioSummary();
    clearAllPortfolioSummaries();
    entregar({ output, correlation_id: REQ_ID });
    await emVoo;

    // A resposta chegou DEPOIS do logout: descartada pela guarda de epoch.
    expect(getSlice().result).toBeNull();
  });

  it("notifica quem está montado, em vez de descartar os listeners", async () => {
    vi.mocked(summarizePortfolioWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    const cb = vi.fn();
    subscribe(cb);
    await runPortfolioSummary();
    cb.mockClear();

    clearAllPortfolioSummaries();

    // Um drawer aberto precisa ser avisado para voltar ao IDLE — não pode ficar surdo.
    expect(cb).toHaveBeenCalled();
  });
});

describe("portfolioSummaryStore — reencontrar a run (409 portfolio_summary_in_progress)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("o 409 não vira erro: o store acompanha a run e entrega o resultado", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioSummaryRun)
      .mockResolvedValueOnce({ run_id: RUN_ID, correlation_id: REQ_ID, status: "running" })
      .mockResolvedValueOnce({
        run_id: RUN_ID,
        correlation_id: REQ_ID,
        status: "ok",
        output,
        computed_at: "2026-07-23T09:15:00-03:00",
      });

    const emVoo = runPortfolioSummary();

    await vi.advanceTimersByTimeAsync(3_000);
    expect(getSlice().loading).toBe(true);
    expect(getSlice().error).toBe("");

    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice().result?.portfolio_read.client_count).toBe(10);
    expect(getSlice().loading).toBe(false);
    expect(getSlice().computedAt).toBe("2026-07-23T09:15:00-03:00");
    expect(getSlice().cached).toBe(false);
    // UM relatório foi pago, não dois — o F5 no card não custou de novo.
    expect(summarizePortfolioWithAi).toHaveBeenCalledTimes(1);
    expect(getAiPortfolioSummaryRun).toHaveBeenCalledWith(RUN_ID);
  });

  it("enquanto acompanha, reabrir o drawer NÃO dispara outro relatório", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioSummaryRun).mockResolvedValue({
      run_id: RUN_ID,
      correlation_id: REQ_ID,
      status: "running",
    });

    const emVoo = runPortfolioSummary();
    await vi.advanceTimersByTimeAsync(3_000);

    await runPortfolioSummary();
    await runPortfolioSummary();

    expect(summarizePortfolioWithAi).toHaveBeenCalledTimes(1);

    clearAllPortfolioSummaries();
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;
  });

  it("a run reencontrada que termina mal vira a MESMA mensagem de falha do POST", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioSummaryRun).mockResolvedValue({
      run_id: RUN_ID,
      correlation_id: REQ_ID,
      status: "blocked",
    });

    const emVoo = runPortfolioSummary();
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice().result).toBeNull();
    expect(getSlice().error).toMatch(/não foi possível gerar o relatório/i);
  });

  it("run reencontrada em insufficient_data mantém o estado neutro", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioSummaryRun).mockResolvedValue({
      run_id: RUN_ID,
      correlation_id: REQ_ID,
      status: "insufficient_data",
    });

    const emVoo = runPortfolioSummary();
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice().errorCode).toBe("insufficient_data");
    expect(getSlice().error).toMatch(/ainda não tem clientes na carteira/i);
  });

  it("um 409 SEM run_id (request-id repetido) continua sendo o erro de sempre", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(
      httpError(409, { code: "duplicate_request" })
    );

    await runPortfolioSummary();

    expect(getSlice().error).toMatch(/em andamento/i);
    expect(getAiPortfolioSummaryRun).not.toHaveBeenCalled();
  });

  it("404 no GET da run = relatório sumiu, não a carteira", async () => {
    vi.mocked(summarizePortfolioWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioSummaryRun).mockRejectedValue(httpError(404));

    const emVoo = runPortfolioSummary();
    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice().error).toMatch(/recuperar o relatório em andamento/i);
  });
});
