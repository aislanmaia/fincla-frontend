// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConsultantSummary } from "../useConsultantSummary.js";

vi.mock("../../../../api/consultant", () => ({
  getConsultantSummary: vi.fn(),
}));

import { getConsultantSummary } from "../../../../api/consultant";

const sample = {
  total_income: 50000,
  total_expenses: 32000,
  balance: 18000,
  total_transactions: 245,
  organizations_count: 8,
  period_start: "2026-06-01",
  period_end: "2026-06-30",
};

beforeEach(() => {
  vi.mocked(getConsultantSummary).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConsultantSummary", () => {
  it("fetches on mount when enabled and exposes the summary", async () => {
    vi.mocked(getConsultantSummary).mockResolvedValue(sample);

    const { result } = renderHook(() => useConsultantSummary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary?.balance).toBe(18000);
    expect(result.current.summary?.organizations_count).toBe(8);
    expect(result.current.error).toBe("");
    expect(getConsultantSummary).toHaveBeenCalledTimes(1);
  });

  it("forwards the date range as snake_case params", async () => {
    vi.mocked(getConsultantSummary).mockResolvedValue(sample);

    renderHook(() =>
      useConsultantSummary({ dateStart: "2026-01-01", dateEnd: "2026-01-31" })
    );

    await waitFor(() =>
      expect(getConsultantSummary).toHaveBeenCalledWith({
        date_start: "2026-01-01",
        date_end: "2026-01-31",
      })
    );
  });

  it("keeps only the latest response when an older fetch resolves last", async () => {
    // The mount fetch stays pending; a newer refresh must win over it.
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(getConsultantSummary)
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ ...sample, balance: 99000 });

    const { result } = renderHook(() => useConsultantSummary());

    // Mount fetch (#1) is in flight and still pending; trigger a newer fetch.
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.summary?.balance).toBe(99000));

    // Now the stale first request resolves last — it must be ignored.
    await act(async () => {
      resolveFirst(sample);
      await first;
    });
    expect(result.current.summary?.balance).toBe(99000);
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(() => useConsultantSummary({ enabled: false }));
    // Give the effect a microtask to flush; nothing should happen.
    await Promise.resolve();
    expect(getConsultantSummary).not.toHaveBeenCalled();
  });

  it("sets error on an initial-load failure", async () => {
    vi.mocked(getConsultantSummary).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useConsultantSummary());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.hasLoaded).toBe(true);
  });

  it("preserves the last-good summary when a refresh fails", async () => {
    vi.mocked(getConsultantSummary)
      .mockResolvedValueOnce(sample)
      .mockRejectedValueOnce(new Error("blip"));

    const { result } = renderHook(() => useConsultantSummary());
    await waitFor(() => expect(result.current.summary).toBeTruthy());

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    // Data stays on screen; only the error surfaces.
    expect(result.current.summary?.balance).toBe(18000);
  });

  it("exposes hasLoaded to tell idle apart from a loaded (possibly empty) result", async () => {
    vi.mocked(getConsultantSummary).mockResolvedValue(sample);

    const { result } = renderHook(() => useConsultantSummary());
    expect(result.current.hasLoaded).toBe(false);
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  });

  it("refresh re-fetches and updates state", async () => {
    vi.mocked(getConsultantSummary)
      .mockResolvedValueOnce(sample)
      .mockResolvedValueOnce({ ...sample, balance: 21000 });

    const { result } = renderHook(() => useConsultantSummary());
    await waitFor(() => expect(result.current.summary).toBeTruthy());
    expect(result.current.summary.balance).toBe(18000);

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.summary.balance).toBe(21000));
    expect(getConsultantSummary).toHaveBeenCalledTimes(2);
  });
});
