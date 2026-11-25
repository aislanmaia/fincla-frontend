// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

// Mocked at the adapter the hook calls, so the hook's own refetch wiring is what runs.
vi.mock("../../../data/dashboardAdapter", () => ({
  fetchAllTransactionsPages: vi.fn(async () => []),
  formatDashboardApiError: vi.fn(() => "erro"),
  getByCategory: vi.fn(async () => []),
  getTransactionsSummary: vi.fn(async () => ({ total_income: "0", total_expense: "0", count: 0 })),
  listRecurringTransactions: vi.fn(async () => []),
}));
vi.mock("../../../../api/balances", () => ({ getBalanceSummary: vi.fn(async () => null) }));

import { getTransactionsSummary } from "../../../data/dashboardAdapter";
import { useDashboardData } from "../useDashboardData.js";

beforeEach(() => vi.clearAllMocks());

// Hoje (errado): a transaction saved from the Visão Geral left its cards at the old values until the
// person left the page and came back. Esperado: the app's "transactions changed" token refetches them.
it("refetches the Visão Geral cards when a transaction is saved (refreshKey bump)", async () => {
  const props = { organizationId: "org-1", dateStart: "2026-11-01", dateEnd: "2026-11-30", refreshKey: 0 };
  const { rerender } = renderHook((p) => useDashboardData(p), { initialProps: props });
  await waitFor(() => expect(getTransactionsSummary).toHaveBeenCalled());
  const before = getTransactionsSummary.mock.calls.length;

  rerender({ ...props, refreshKey: 1 });

  await waitFor(() => expect(getTransactionsSummary.mock.calls.length).toBeGreaterThan(before));
});

it("does not refetch while nothing was saved", async () => {
  const props = { organizationId: "org-1", dateStart: "2026-11-01", dateEnd: "2026-11-30", refreshKey: 0 };
  const { rerender } = renderHook((p) => useDashboardData(p), { initialProps: props });
  await waitFor(() => expect(getTransactionsSummary).toHaveBeenCalled());
  const before = getTransactionsSummary.mock.calls.length;

  rerender({ ...props });
  await new Promise((r) => setTimeout(r, 50));

  expect(getTransactionsSummary.mock.calls.length).toBe(before);
});

// G3-1-01: a Visão Geral escreve os totais com o símbolo da moeda BASE e os compara com a renda declarada
// (na base). Ela não pode pedir a moeda do recorte: num mês só com lançamentos em dólar de uma organização em
// real, o servidor responderia US$ e a tela escreveria "R$ 50,00" para US$ 50. Sem o parâmetro, o servidor
// converte para a base (teste do backend: test_without_the_parameter_a_foreign_only_slice_is_converted...).
it("pede o resumo do período SEM slice_currency, para receber os totais na moeda base", async () => {
  const props = { organizationId: "org-1", dateStart: "2026-11-01", dateEnd: "2026-11-30", refreshKey: 0 };
  renderHook((p) => useDashboardData(p), { initialProps: props });
  await waitFor(() => expect(getTransactionsSummary).toHaveBeenCalled());

  for (const [query] of getTransactionsSummary.mock.calls) {
    expect(query).not.toHaveProperty("slice_currency");
    expect(query).toMatchObject({ organization_id: "org-1" });
  }
});
