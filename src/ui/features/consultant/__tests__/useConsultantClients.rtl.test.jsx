// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConsultantClients } from "../useConsultantClients.js";

vi.mock("../../../../api/consultant", () => ({
  getConsultantClients: vi.fn(),
}));

import { getConsultantClients } from "../../../../api/consultant";

const sample = {
  total: 1,
  clients: [
    {
      organization_id: "org-1",
      organization_name: "Finanças em Desequilíbrio",
      role: "consultant",
      membership_created_at: "2026-06-15T10:00:00Z",
      client_name: "Mariana Costa",
      health: 42.5,
      balance: "-3340.00",
      savings_pct: -18.6,
      debt_pct: 55.0,
      trend: "down",
      last_active: "2026-06-28",
      patrimonio: "12500.00",
    },
  ],
};

beforeEach(() => {
  vi.mocked(getConsultantClients).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConsultantClients", () => {
  it("fetches on mount and exposes enriched clients + total", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue(sample);

    const { result } = renderHook(() => useConsultantClients());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.clients).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.loadedOk).toBe(true);
    const client = result.current.clients[0];
    expect(client.client_name).toBe("Mariana Costa");
    expect(client.health).toBe(42.5);
    expect(client.patrimonio).toBe("12500.00");
    expect(client.trend).toBe("down");
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(() => useConsultantClients({ enabled: false }));
    await Promise.resolve();
    expect(getConsultantClients).not.toHaveBeenCalled();
  });

  it("keeps last-good clients on a refresh error", async () => {
    vi.mocked(getConsultantClients)
      .mockResolvedValueOnce(sample)
      .mockRejectedValueOnce(new Error("blip"));

    const { result } = renderHook(() => useConsultantClients());
    await waitFor(() => expect(result.current.clients).toHaveLength(1));

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.clients).toHaveLength(1);
    expect(result.current.loadedOk).toBe(true);
  });

  it("resets state when disabled after a load", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue(sample);
    const { result, rerender } = renderHook(
      ({ enabled }) => useConsultantClients({ enabled }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.clients).toHaveLength(1));

    rerender({ enabled: false });
    await waitFor(() => expect(result.current.clients).toHaveLength(0));
    expect(result.current.total).toBe(0);
    expect(result.current.hasLoaded).toBe(false);
  });
});
