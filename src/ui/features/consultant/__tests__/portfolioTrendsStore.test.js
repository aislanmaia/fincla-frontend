import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  detectPortfolioTrendsWithAi: vi.fn(),
  getAiPortfolioTrendsRun: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import {
  detectPortfolioTrendsWithAi,
  getAiPortfolioTrendsRun,
  newEvaluationRequestId,
} from "../../../../api/consultant";
import {
  __resetStore,
  clearAllPortfolioTrends,
  getSlice,
  runPortfolioTrends,
} from "../portfolioTrendsStore.js";

const REQ_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

const output = {
  trends: [
    {
      tone: "risk",
      title: "Risco concentrado",
      description: "4 clientes em risco.",
      evidence: [{ metric: "at_risk_count", value: 4, source_tool: "get_portfolio_aggregates" }],
    },
    {
      tone: "opportunity",
      title: "Janela",
      description: "2 clientes com folga.",
      evidence: [{ metric: "clients_count", value: 10, source_tool: "get_portfolio_aggregates" }],
    },
  ],
  disclaimers: ["Apoio ao consultor."],
};

beforeEach(() => {
  vi.mocked(detectPortfolioTrendsWithAi).mockReset();
  vi.mocked(getAiPortfolioTrendsRun).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
  __resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

const inProgress = (runId = RUN_ID) =>
  Object.assign(new Error("HTTP 409"), {
    response: {
      status: 409,
      data: { detail: { code: "trends_detection_in_progress", message: "x", run_id: runId } },
    },
  });

const httpError = (status, detail) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: detail ? { detail } : {} },
  });

describe("portfolioTrendsStore — execução", () => {
  it("run() bem-sucedida entrega as tendências e data o resultado", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioTrends();

    const slice = getSlice();
    expect(slice.result?.trends).toHaveLength(2);
    expect(slice.loading).toBe(false);
    expect(slice.computedAt).toBeTruthy();
    expect(slice.cached).toBe(false);
  });

  it("é idempotente: um segundo run() não paga outra detecção (a tela auto-dispara)", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioTrends();
    await runPortfolioTrends();

    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(1);
  });

  it("depois de um ERRO, o auto-run não retenta sozinho (só o Atualizar)", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(httpError(422));

    await runPortfolioTrends();
    await runPortfolioTrends(); // reentrada da tela: NÃO deve re-pagar

    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(1);
    expect(getSlice().error).toMatch(/detectar tendências/i);
  });

  it("refresh fura a idempotência e força uma execução nova", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });

    await runPortfolioTrends();
    await runPortfolioTrends({ refresh: true });

    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(2);
    expect(detectPortfolioTrendsWithAi).toHaveBeenLastCalledWith(REQ_ID, true);
  });

  it("um refresh que falha preserva as tendências anteriores", async () => {
    vi.mocked(detectPortfolioTrendsWithAi)
      .mockResolvedValueOnce({ output, correlation_id: REQ_ID })
      .mockRejectedValueOnce(httpError(422));

    await runPortfolioTrends();
    await runPortfolioTrends({ refresh: true });

    const slice = getSlice();
    expect(slice.result?.trends).toHaveLength(2);
    expect(slice.error).toMatch(/detectar tendências/i);
  });

  it("carteira sem clientes vira estado neutro (insufficient_data)", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(
      httpError(422, { code: "insufficient_data", message: "sem clientes" })
    );

    await runPortfolioTrends();

    expect(getSlice().errorCode).toBe("insufficient_data");
    expect(getSlice().error).toMatch(/ainda não tem clientes/i);
  });

  it("429 fala de detecções de tendências", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(httpError(429));

    await runPortfolioTrends();

    expect(getSlice().error).toMatch(/detecções de tendências/i);
  });
});

describe("portfolioTrendsStore — fim de sessão", () => {
  it("esquece as tendências: o próximo consultor não herda as do anterior", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runPortfolioTrends();
    expect(getSlice().result).not.toBeNull();

    clearAllPortfolioTrends();

    expect(getSlice().result).toBeNull();
  });

  it("uma run da sessão anterior que resolve tarde não libera o guard da run atual", async () => {
    let resolveA;
    let resolveB;
    vi.mocked(detectPortfolioTrendsWithAi)
      .mockReturnValueOnce(new Promise((r) => { resolveA = r; }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r; }))
      .mockReturnValueOnce(new Promise(() => {}));

    const runA = runPortfolioTrends();
    clearAllPortfolioTrends();
    const runB = runPortfolioTrends();
    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(2);

    resolveA({ output, correlation_id: REQ_ID });
    await runA;

    await runPortfolioTrends();
    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(2);

    clearAllPortfolioTrends();
    resolveB?.({ output, correlation_id: REQ_ID });
    await runB;
  });
});

describe("portfolioTrendsStore — reencontrar (409 trends_detection_in_progress)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("o 409 não vira erro: acompanha a run e entrega o resultado", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(inProgress());
    vi.mocked(getAiPortfolioTrendsRun)
      .mockResolvedValueOnce({ run_id: RUN_ID, correlation_id: REQ_ID, status: "running" })
      .mockResolvedValueOnce({ run_id: RUN_ID, correlation_id: REQ_ID, status: "ok", output });

    const emVoo = runPortfolioTrends();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(getSlice().loading).toBe(true);

    await vi.advanceTimersByTimeAsync(3_000);
    await emVoo;

    expect(getSlice().result?.trends).toHaveLength(2);
    expect(detectPortfolioTrendsWithAi).toHaveBeenCalledTimes(1);
    expect(getAiPortfolioTrendsRun).toHaveBeenCalledWith(RUN_ID);
  });

  it("um 409 SEM run_id continua sendo o erro de sempre", async () => {
    vi.mocked(detectPortfolioTrendsWithAi).mockRejectedValue(
      httpError(409, { code: "duplicate_request" })
    );

    await runPortfolioTrends();

    expect(getSlice().error).toMatch(/em andamento/i);
    expect(getAiPortfolioTrendsRun).not.toHaveBeenCalled();
  });
});
