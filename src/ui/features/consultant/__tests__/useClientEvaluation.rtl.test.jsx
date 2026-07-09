// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClientEvaluation } from "../useClientEvaluation.js";

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import { evaluateClientWithAi, newEvaluationRequestId } from "../../../../api/consultant";

const ORG = "11111111-1111-4111-8111-111111111111";
const REQ_ID = "22222222-2222-4222-8222-222222222222";

const output = {
  summary: "Cliente em atencao.",
  health_read: { score: 61, label: "Atenção", headline: "Renda comprometida." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: ["Analise de apoio ao consultor."],
};

/** Erro no formato do axios (o hook lê `err.response.status`). */
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), {
  response: { status },
});

beforeEach(() => {
  vi.mocked(evaluateClientWithAi).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useClientEvaluation", () => {
  it("does not fire on mount — it runs on demand", async () => {
    renderHook(() => useClientEvaluation(ORG));
    await Promise.resolve();
    expect(evaluateClientWithAi).not.toHaveBeenCalled();
  });

  it("run() sends a UUID X-Request-Id and exposes the output", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID,
      session_id: "sess-1",
      run_id: "33333333-3333-4333-8333-333333333333",
      output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    act(() => {
      result.current.run();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(evaluateClientWithAi).toHaveBeenCalledWith(ORG, REQ_ID);
    expect(result.current.result?.health_read.score).toBe(61);
    expect(result.current.correlationId).toBe(REQ_ID);
    expect(result.current.error).toBe("");
  });

  it("keeps the backend's correlation_id when it echoes a different one", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: "44444444-4444-4444-8444-444444444444",
      session_id: "sess-1",
      run_id: "33333333-3333-4333-8333-333333333333",
      output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    act(() => {
      result.current.run();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.correlationId).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("ignores a second run() while one is already in flight", async () => {
    let resolve;
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useClientEvaluation(ORG));
    act(() => {
      result.current.run();
      result.current.run();
    });

    expect(evaluateClientWithAi).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ correlation_id: REQ_ID, session_id: "s", run_id: "r", output });
    });
  });

  it.each([
    [402, /limite de uso da ia/i],
    [403, /plano/i],
    [404, /carteira/i],
    [409, /em andamento/i],
    [422, /não foi possível gerar/i],
  ])("maps HTTP %i to its own message", async (status, expected) => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(httpError(status));

    const { result } = renderHook(() => useClientEvaluation(ORG));
    act(() => {
      result.current.run();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(expected);
    expect(result.current.result).toBeNull();
  });

  it("falls back to handleApiError for unmapped failures", async () => {
    vi.mocked(evaluateClientWithAi).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useClientEvaluation(ORG));
    act(() => {
      result.current.run();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("erro generico");
  });

  it("generates a fresh request id per run — reusing it would 409", async () => {
    vi.mocked(newEvaluationRequestId)
      .mockReturnValueOnce(REQ_ID)
      .mockReturnValueOnce("55555555-5555-4555-8555-555555555555");
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID, session_id: "s", run_id: "r", output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.run(); });

    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(1, ORG, REQ_ID);
    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(
      2, ORG, "55555555-5555-4555-8555-555555555555"
    );
  });

  it("clears a stale result when the client changes", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID, session_id: "s", run_id: "r", output,
    });

    const { result, rerender } = renderHook(({ org }) => useClientEvaluation(org), {
      initialProps: { org: ORG },
    });
    await act(async () => { await result.current.run(); });
    expect(result.current.result).toBeTruthy();

    rerender({ org: "99999999-9999-4999-8999-999999999999" });
    expect(result.current.result).toBeNull();
  });

  it("reset() clears the result", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID, session_id: "s", run_id: "r", output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });
    act(() => { result.current.reset(); });

    expect(result.current.result).toBeNull();
    expect(result.current.correlationId).toBe("");
  });
});
