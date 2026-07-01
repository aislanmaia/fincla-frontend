// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConsultantHealthIndex } from "../useConsultantHealthIndex.js";

vi.mock("../../../../api/consultant", () => ({
  getFinancialHealthIndex: vi.fn(),
}));

import { getFinancialHealthIndex } from "../../../../api/consultant";

const sample = {
  index: 72,
  balance_score: 80,
  debt_score: 65,
  reserve_score: 70,
  total_income: 50000,
  total_expenses: 32000,
  balance: 18000,
  total_debt: 12000,
  organizations_count: 8,
  period_start: "2026-06-01",
  period_end: "2026-06-30",
  formula_info: "avg of scores",
};

beforeEach(() => {
  vi.mocked(getFinancialHealthIndex).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConsultantHealthIndex", () => {
  it("fetches on mount and exposes the health index", async () => {
    vi.mocked(getFinancialHealthIndex).mockResolvedValue(sample);

    const { result } = renderHook(() => useConsultantHealthIndex());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.healthIndex?.index).toBe(72);
    expect(result.current.error).toBe("");
    expect(result.current.hasLoaded).toBe(true);
  });

  it("forwards the date range as snake_case params", async () => {
    vi.mocked(getFinancialHealthIndex).mockResolvedValue(sample);

    renderHook(() =>
      useConsultantHealthIndex({ dateStart: "2026-01-01", dateEnd: "2026-01-31" })
    );

    await waitFor(() =>
      expect(getFinancialHealthIndex).toHaveBeenCalledWith({
        date_start: "2026-01-01",
        date_end: "2026-01-31",
      })
    );
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(() => useConsultantHealthIndex({ enabled: false }));
    await Promise.resolve();
    expect(getFinancialHealthIndex).not.toHaveBeenCalled();
  });

  it("sets error on failure and keeps last-good data", async () => {
    vi.mocked(getFinancialHealthIndex)
      .mockResolvedValueOnce(sample)
      .mockRejectedValueOnce(new Error("blip"));

    const { result } = renderHook(() => useConsultantHealthIndex());
    await waitFor(() => expect(result.current.healthIndex).toBeTruthy());

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.healthIndex?.index).toBe(72);
  });
});
