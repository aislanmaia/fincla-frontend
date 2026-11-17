import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #331 — a velocidade de Relatórios acumulava US$ 100 como R$ 100. Agora as
 * estrangeiras entram pela taxa do recibo de `/transactions/summary` do mês; sem
 * taxa, a série não é desenhada.
 */
const listTransactions = vi.fn();
const getTransactionsSummary = vi.fn();
const getByCategory = vi.fn(() => Promise.resolve({ categories: [] }));
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: (...a) => listTransactions(...a),
  getTransactionsSummary: (...a) => getTransactionsSummary(...a),
}));
vi.mock("../../../api/analytics", () => ({
  getMonthlyEvolution: () =>
    Promise.resolve({ months: [{ year: 2026, month: 9, total_income: 1000, total_expenses: 600, balance: 400 }] }),
  getSpendingRhythm: () => Promise.resolve({ months: [], categories: [] }),
  getByCategory: (...a) => getByCategory(...a),
}));
import { fetchReportsAnalytics } from "../reportsAdapter.js";

afterEach(() => {
  vi.clearAllMocks();
  getByCategory.mockImplementation(() => Promise.resolve({ categories: [] }));
});

const exp = (date, value, currency) => ({ type: "expense", date, value, value_currency: currency });

describe("fetchReportsAnalytics — velocidade em moedas (#331)", () => {
  it("R$ 100 + US$ 100 com taxa 5 acumulam R$ 600, não R$ 200", async () => {
    listTransactions.mockResolvedValue({ data: [exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 100, "USD")], pagination: { has_next: false } });
    getTransactionsSummary.mockResolvedValue({ consolidation: { target_currency: "BRL", rates: [{ base: "USD", quote: "BRL", rate: "5.0000000000" }] } });
    const { velocityDaily } = await fetchReportsAnalytics("org-1", "3m");
    expect(velocityDaily.at(-1).real).toBe(600);
  });

  it("resumo fora do ar: usa o recibo de by-category da mesma janela", async () => {
    listTransactions.mockResolvedValue({ data: [exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 100, "USD")], pagination: { has_next: false } });
    getTransactionsSummary.mockRejectedValue(new Error("down"));
    getByCategory.mockResolvedValue({ categories: [], consolidation: { target_currency: "BRL", rates: [{ base: "USD", quote: "BRL", rate: "5.0000000000" }] } });
    const { velocityDaily } = await fetchReportsAnalytics("org-1", "3m");
    expect(velocityDaily.at(-1).real).toBe(600);
  });

  it("sem taxa: velocidade vazia, nunca a soma crua", async () => {
    listTransactions.mockResolvedValue({ data: [exp("2026-09-02", 100, "BRL"), exp("2026-09-03", 100, "USD")], pagination: { has_next: false } });
    getTransactionsSummary.mockResolvedValue({ consolidation: { target_currency: "BRL", rates: [] } });
    const { velocityDaily } = await fetchReportsAnalytics("org-1", "3m");
    expect(velocityDaily).toEqual([]);
  });
});
