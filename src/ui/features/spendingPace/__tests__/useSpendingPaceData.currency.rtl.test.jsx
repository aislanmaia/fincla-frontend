/** @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #331 — a tela Ritmo de Gastos somava US$ 100 como R$ 100 no gasto do mês. Agora
 * as estrangeiras entram pela taxa do recibo de `/transactions/summary`; sem taxa,
 * a tela diz que o mês está indisponível em vez de mostrar a soma crua.
 */
const fetchTxMock = vi.fn();
const summaryMock = vi.fn();
vi.mock("../../../data/dashboardAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: (...args) => fetchTxMock(...args),
}));
vi.mock("../../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: () => Promise.resolve({ budgets: [] }),
}));
vi.mock("../../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  getTransactionsSummary: (...args) => summaryMock(...args),
}));
import { useSpendingPaceData } from "../useSpendingPaceData.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const exp = (date, value, currency) => ({ type: "expense", date, value, value_currency: currency });
const page = (data) => ({ data, pagination: { has_next: false } });
const RECEIPT = { consolidation: { target_currency: "BRL", rates: [{ base: "USD", quote: "BRL", rate: "5.0000000000" }] } };

const render = () =>
  renderHook(() => useSpendingPaceData({ organizationId: "org-1", enabled: true, year: 2026, month: 9 }));

describe("useSpendingPaceData — moedas (#331)", () => {
  it("R$ 100 + US$ 100 com taxa 5 = R$ 600 no mês, não R$ 200", async () => {
    fetchTxMock.mockResolvedValue(page([exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 100, "USD")]));
    summaryMock.mockResolvedValue(RECEIPT);
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.projFim).toBe(600);
  });

  it("sem taxa para a moeda estrangeira: indisponível, sem soma crua", async () => {
    fetchTxMock.mockResolvedValue(page([exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 100, "USD")]));
    summaryMock.mockResolvedValue({ consolidation: { target_currency: "BRL", rates: [] } });
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/mais de uma moeda/);
    expect(result.current.projFim).not.toBe(200);
  });

  it("uma moeda só, na base: soma de sempre", async () => {
    fetchTxMock.mockResolvedValue(page([exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 50, "BRL")]));
    summaryMock.mockResolvedValue(RECEIPT);
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.projFim).toBe(150);
  });

  it("resumo fora do ar: erro de rede (com tentar de novo), não \"falta cotação\" nem soma crua", async () => {
    fetchTxMock.mockResolvedValue(page([exp("2026-09-02", 100, "USD")]));
    summaryMock.mockRejectedValue(new Error("Network Error"));
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBe("");
    expect(result.current.error).not.toMatch(/mais de uma moeda/);
    expect(result.current.projFim).not.toBe(100);
  });
});
