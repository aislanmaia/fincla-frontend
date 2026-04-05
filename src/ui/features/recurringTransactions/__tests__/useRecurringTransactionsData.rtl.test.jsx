/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as adapter from "../../../data/recurringTransactionsAdapter.js";
import { useRecurringTransactionsData } from "../useRecurringTransactionsData.js";

vi.mock("../../../data/recurringTransactionsAdapter.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listRecurringTransactionsForUi: vi.fn(),
  };
});

const seriesFixture = {
  id: "rt-1",
  organization_id: "org-1",
  logical_series_id: "log-1",
  type: "expense",
  description: "Conta de luz",
  value: 180,
  value_kind: "exact",
  category: "Utilidades",
  payment_method: "boleto",
  frequency: "monthly",
  start_date: "2020-01-15",
  next_occurrence: "2026-03-13",
  is_active: true,
  created_at: "",
  updated_at: "",
  tags: [
    {
      id: "t1",
      name: "Utilidades",
      color: "#2563EB",
      icon_key: null,
      is_default: false,
      is_active: true,
      organization_id: "org-1",
      tag_type: { id: "tt1", name: "categoria" },
    },
  ],
  day_of_month: 13,
  day_of_week: null,
  end_date: null,
  credit_card_id: null,
  notes: null,
  replaces_series_id: null,
};

describe("useRecurringTransactionsData (RTL)", () => {
  beforeEach(() => {
    vi.mocked(adapter.listRecurringTransactionsForUi).mockResolvedValue({
      series: [seriesFixture],
      summary: {
        total_monthly_income: 0,
        total_monthly_expense: 180,
        active_count: 1,
        paused_count: 0,
      },
    });
  });

  it("carrega lista quando há organizationId e enabled", async () => {
    const { result } = renderHook(() =>
      useRecurringTransactionsData({
        organizationId: "org-1",
        enabled: true,
        refreshKey: 0,
      }),
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.list).toHaveLength(1);
    expect(result.current.list[0].desc).toBe("Conta de luz");
    expect(result.current.hasRealData).toBe(true);
  });

  it("permanece vazio sem organizationId", () => {
    const { result } = renderHook(() =>
      useRecurringTransactionsData({ organizationId: null, enabled: true }),
    );
    expect(result.current.list).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
