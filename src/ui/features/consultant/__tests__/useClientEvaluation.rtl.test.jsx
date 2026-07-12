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
    expect(evaluateClientWithAi).toHaveBeenCalledWith(ORG, REQ_ID, {}, false);
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

    // `{}, false` = body vazio, sem `?refresh` — a assinatura ganhou esses dois
    // argumentos com o cache (dívida 1.1b); o id novo por run continua sendo o ponto.
    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(1, ORG, REQ_ID, {}, false);
    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(
      2, ORG, "55555555-5555-4555-8555-555555555555", {}, false
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

describe("useClientEvaluation — cache (dívida 1.1b)", () => {
  it("expõe cached/computedAt quando o backend reaproveita uma avaliação", async () => {
    evaluateClientWithAi.mockResolvedValue({
      output,
      correlation_id: REQ_ID,
      cached: true,
      computed_at: "2026-07-11T14:20:00-03:00",
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.cached).toBe(true);
    expect(result.current.computedAt).toBe("2026-07-11T14:20:00-03:00");
  });

  it("trata um backend SEM os campos de cache como 'não é cache'", async () => {
    // Deploy do FE pode preceder o do backend. Ausência não pode virar `undefined`
    // vazando para a UI — o drawer mostraria a faixa de cache sem ter idade nenhuma.
    evaluateClientWithAi.mockResolvedValue({ output, correlation_id: REQ_ID });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.cached).toBe(false);
    expect(result.current.computedAt).toBeNull();
  });

  it("run() normal NÃO pede refresh — senão o cache nunca serviria pra nada", async () => {
    evaluateClientWithAi.mockResolvedValue({ output, correlation_id: REQ_ID, cached: true });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    expect(evaluateClientWithAi).toHaveBeenCalledWith(ORG, REQ_ID, {}, false);
  });

  it("um refresh que FALHA preserva a avaliação que estava na tela", async () => {
    // Encontrado exercitando contra o backend real: a pipeline de IA falha com
    // frequência (grounding, schema, timeout do provider). Se um "Recalcular"
    // frustrado apagasse a análise boa, o botão seria uma aposta — o consultor
    // clica e pode sair com MENOS do que tinha. O resultado anterior sobrevive.
    evaluateClientWithAi
      .mockResolvedValueOnce({
        output, correlation_id: REQ_ID, cached: true, computed_at: "2026-07-12T11:38:22-03:00",
      })
      .mockRejectedValueOnce(httpError(422));

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });
    expect(result.current.result).toBeTruthy();

    await act(async () => { await result.current.refresh(); });

    expect(result.current.result?.health_read.score).toBe(61);
    expect(result.current.error).toMatch(/não foi possível gerar/i);
    // A idade e o id continuam sendo os da análise EXIBIDA, não os da run morta.
    expect(result.current.cached).toBe(true);
    expect(result.current.computedAt).toBe("2026-07-12T11:38:22-03:00");
    expect(result.current.correlationId).toBe(REQ_ID);
  });

  it("mas a PRIMEIRA run que falha não tem o que preservar — cai no erro", async () => {
    // O guard-rail do teste acima: preservar não pode virar "nunca mostrar erro".
    evaluateClientWithAi.mockRejectedValue(httpError(422));

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toMatch(/não foi possível gerar/i);
  });

  it("refresh() envia refresh=true — o botão 'Recalcular' tem de furar o cache", async () => {
    // O teste que carrega o peso. Um `X-Request-Id` novo evita o 409 mas NÃO fura
    // o cache: sem o `refresh=true`, "Recalcular" devolveria a MESMA avaliação em
    // cache e o botão estaria mentindo para o consultor.
    evaluateClientWithAi.mockResolvedValue({ output, correlation_id: REQ_ID, cached: false });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.refresh(); });

    expect(evaluateClientWithAi).toHaveBeenCalledWith(ORG, REQ_ID, {}, true);
    await waitFor(() => expect(result.current.cached).toBe(false));
  });
});
