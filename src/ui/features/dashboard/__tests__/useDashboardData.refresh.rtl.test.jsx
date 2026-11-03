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
