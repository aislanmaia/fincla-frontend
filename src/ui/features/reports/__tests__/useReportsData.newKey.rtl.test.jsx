/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #300 (revisão) — a chave da última leitura boa só andava no sucesso. Depois de
 * uma leitura de OUTRO período falhar, voltar ao período antigo era tratado como
 * "recarga" de um estado que já era o da falha: a tela mostrava "Sem dados para
 * exibir" em vez de "Carregando". Hook real; o dublê é a leitura do adapter.
 */
const fetchMock = vi.fn();
vi.mock("../../../data/reportsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportsAnalytics: (...args) => fetchMock(...args),
}));
import { useReportsData } from "../useReportsData.js";

const result = { monthlyData: [{ m: "nov", r: 1, g: 1 }], drift: { driftData: [], driftColors: {} }, compositionData: [] };
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useReportsData — falha numa chave nova e volta", () => {
  it("voltar ao período antigo depois de outro falhar é leitura NOVA (carregando, sem erro velho)", async () => {
    fetchMock.mockResolvedValueOnce(result);
    const { result: hook, rerender } = renderHook(({ periodo }) => useReportsData({ organizationId: "org-1", periodo }), {
      initialProps: { periodo: "6m" },
    });
    await waitFor(() => expect(hook.current.hasRealData).toBe(true));

    fetchMock.mockRejectedValueOnce(new Error("boom"));
    rerender({ periodo: "12m" });
    await waitFor(() => expect(hook.current.error).not.toBe(""));

    let release;
    fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(result); }));
    rerender({ periodo: "6m" });
    expect(hook.current.isLoading).toBe(true);
    expect(hook.current.error).toBe("");
    await act(async () => release());
    await waitFor(() => expect(hook.current.hasRealData).toBe(true));
  });
});
