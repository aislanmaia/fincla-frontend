// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConsultantClientsAtRisk } from "../useConsultantClientsAtRisk.js";

vi.mock("../../../../api/consultant", () => ({
  getClientsAtRisk: vi.fn(),
}));

import { getClientsAtRisk } from "../../../../api/consultant";

const sample = {
  clients: [
    {
      organization_id: "org-1",
      organization_name: "Org 1",
      client_name: "Diego Albuquerque",
      main_situation: "Gasto maior que a renda",
      current_balance: -1200,
      last_invoice_status: "overdue",
      risk_score: 88,
    },
  ],
  total: 1,
  as_of_date: "2026-06-30",
};

beforeEach(() => {
  vi.mocked(getClientsAtRisk).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConsultantClientsAtRisk", () => {
  it("fetches on mount and exposes clients + total", async () => {
    vi.mocked(getClientsAtRisk).mockResolvedValue(sample);

    const { result } = renderHook(() => useConsultantClientsAtRisk());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clients).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.hasLoaded).toBe(true);
  });

  it("forwards the limit param", async () => {
    vi.mocked(getClientsAtRisk).mockResolvedValue(sample);

    renderHook(() => useConsultantClientsAtRisk({ limit: 4 }));

    await waitFor(() =>
      expect(getClientsAtRisk).toHaveBeenCalledWith({ limit: 4 })
    );
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(() => useConsultantClientsAtRisk({ enabled: false }));
    await Promise.resolve();
    expect(getClientsAtRisk).not.toHaveBeenCalled();
  });

  it("keeps last-good clients on a refresh error", async () => {
    vi.mocked(getClientsAtRisk)
      .mockResolvedValueOnce(sample)
      .mockRejectedValueOnce(new Error("blip"));

    const { result } = renderHook(() => useConsultantClientsAtRisk());
    await waitFor(() => expect(result.current.clients).toHaveLength(1));

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.clients).toHaveLength(1);
  });
});
