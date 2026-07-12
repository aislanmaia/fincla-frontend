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
import { __resetStore } from "../clientEvaluationStore.js";

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
  // O estado vive fora do React (por cliente) — sem isto um teste herda a
  // avaliação do anterior.
  __resetStore();
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

  it("cada execução leva um request id novo — reusá-lo daria 409", async () => {
    // `run()` é idempotente por cliente (ele GARANTE uma avaliação, não dispara
    // uma), então quem executa de novo é o `refresh()`. O ponto do teste continua
    // sendo o mesmo: nenhuma execução reaproveita o id da anterior.
    vi.mocked(newEvaluationRequestId)
      .mockReturnValueOnce(REQ_ID)
      .mockReturnValueOnce("55555555-5555-4555-8555-555555555555");
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID, session_id: "s", run_id: "r", output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.refresh(); });

    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(1, ORG, REQ_ID, {}, false);
    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(
      2, ORG, "55555555-5555-4555-8555-555555555555", {}, true
    );
  });

  it("run() é idempotente: chamá-lo de novo NÃO paga outra avaliação", async () => {
    // O drawer chama `run()` toda vez que abre. Se isso disparasse uma execução,
    // reabrir o painel custaria uma avaliação nova — que é o bug que originou o
    // store.
    vi.mocked(evaluateClientWithAi).mockResolvedValue({
      correlation_id: REQ_ID, session_id: "s", run_id: "r", output,
    });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.run(); });
    await act(async () => { await result.current.run(); });

    expect(evaluateClientWithAi).toHaveBeenCalledTimes(1);
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
    // vazando para a UI.
    evaluateClientWithAi.mockResolvedValue({ output, correlation_id: REQ_ID });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.cached).toBe(false);
    // A data, porém, nós mesmos cravamos: o resultado fica na tela mesmo com o
    // painel fechado, então ele precisa de idade mesmo contra um backend velho.
    expect(Number.isNaN(Date.parse(result.current.computedAt))).toBe(false);
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

  it("trocar de cliente com uma run em voo: a resposta velha NÃO se pinta no cliente novo", async () => {
    // O hook agora sobrevive ao fechamento do drawer, então a avaliação do
    // cliente A pode ainda estar em voo quando o consultor abre o cliente B.
    // Sem o token de run, a resposta de A chegaria depois e apareceria como se
    // fosse a análise de B — o pior erro possível num produto financeiro.
    let responderA;
    evaluateClientWithAi.mockReturnValueOnce(new Promise((r) => { responderA = r; }));

    const outraOrg = "99999999-9999-4999-8999-999999999999";
    const { result, rerender } = renderHook(({ org }) => useClientEvaluation(org), {
      initialProps: { org: ORG },
    });
    act(() => { result.current.run(); });

    rerender({ org: outraOrg });

    await act(async () => {
      responderA({ output, correlation_id: REQ_ID });
    });

    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("trocar de cliente libera o guard: o cliente novo consegue ser avaliado", async () => {
    // O `inFlight` da run velha não pode trancar a avaliação do cliente novo.
    evaluateClientWithAi.mockReturnValueOnce(new Promise(() => {})); // A fica em voo pra sempre
    evaluateClientWithAi.mockResolvedValueOnce({ output, correlation_id: REQ_ID });

    const outraOrg = "99999999-9999-4999-8999-999999999999";
    const { result, rerender } = renderHook(({ org }) => useClientEvaluation(org), {
      initialProps: { org: ORG },
    });
    act(() => { result.current.run(); });

    rerender({ org: outraOrg });
    await act(async () => { await result.current.run(); });

    expect(evaluateClientWithAi).toHaveBeenNthCalledWith(2, outraOrg, REQ_ID, {}, false);
    expect(result.current.result?.health_read.score).toBe(61);
  });

  it("data uma run nova mesmo sem o backend mandar computed_at", async () => {
    // O drawer não é mais desmontado ao fechar: esta análise pode passar horas na
    // tela. Sem uma data, a faixa de idade sumiria e o consultor olharia um
    // diagnóstico velho achando que é de agora.
    evaluateClientWithAi.mockResolvedValue({ output, correlation_id: REQ_ID, cached: false });

    const { result } = renderHook(() => useClientEvaluation(ORG));
    await act(async () => { await result.current.run(); });

    expect(result.current.cached).toBe(false);
    expect(Number.isNaN(Date.parse(result.current.computedAt))).toBe(false);
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
