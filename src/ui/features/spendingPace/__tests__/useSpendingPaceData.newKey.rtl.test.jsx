/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #300 (revisão) — mês A carregado, mês B falha, volta ao A: antes a volta era
 * tratada como recarga do A e o erro do B ficava por cima. Hook real.
 */
const fetchTxMock = vi.fn();
vi.mock("../../../data/dashboardAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: (...args) => fetchTxMock(...args),
}));
vi.mock("../../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: () => Promise.resolve({ budgets: [] }),
}));
import { useSpendingPaceData } from "../useSpendingPaceData.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const page = { data: [], pagination: { has_next: false } };

describe("useSpendingPaceData — falha noutro mês e volta", () => {
  it("voltar ao mês A depois do B falhar: carregando, sem o erro do B", async () => {
    fetchTxMock.mockResolvedValueOnce(page);
    const { result, rerender } = renderHook(({ month }) => useSpendingPaceData({ organizationId: "org-1", enabled: true, year: 2026, month }), {
      initialProps: { month: 10 },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchTxMock.mockRejectedValueOnce(new Error("boom"));
    rerender({ month: 9 });
    await waitFor(() => expect(result.current.error).not.toBe(""));

    let release;
    fetchTxMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(page); }));
    rerender({ month: 10 });
    expect(result.current.error).toBe("");
    expect(result.current.isLoading).toBe(true);
    await act(async () => release());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("");
  });
});
