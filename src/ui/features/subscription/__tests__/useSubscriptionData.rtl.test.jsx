// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSubscriptionData } from "../useSubscriptionData.js";

vi.mock("../../../../api/subscriptions.js", () => ({
  getCurrentSubscription: vi.fn(),
}));

import { getCurrentSubscription } from "../../../../api/subscriptions.js";

const sample = {
  id: "sub_uuid",
  plan: {
    id: "essential",
    name: "Essential",
    description: "",
    audience: "standard",
    monthly_price_cents: 3990,
    yearly_price_cents: null,
    max_organizations: 1,
    max_users_per_org: 2,
    features: ["manual_transactions"],
    display_order: 10,
  },
  status: "active",
  billing_cycle: "monthly",
  gateway_provider: "manual",
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  cancelled_at: null,
  recent_invoices: [
    {
      id: "inv_1",
      amount_cents: 3990,
      currency: "BRL",
      status: "paid",
      due_date: "2026-05-01",
      paid_at: "2026-05-02T00:00:00",
      payment_method: "pix",
      invoice_url: null,
      pdf_url: null,
      description: "Maio",
    },
  ],
};

beforeEach(() => {
  vi.mocked(getCurrentSubscription).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSubscriptionData", () => {
  it("fetches on mount when enabled and exposes recent_invoices", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue(sample);

    const { result } = renderHook(() => useSubscriptionData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subscription?.id).toBe("sub_uuid");
    expect(result.current.recentInvoices).toHaveLength(1);
    expect(result.current.error).toBe("");
  });

  it("does not fetch when enabled=false", async () => {
    renderHook(() => useSubscriptionData({ enabled: false }));
    // Give the effect a microtask to flush; nothing should happen.
    await Promise.resolve();
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });

  it("sets error and clears subscription on failure", async () => {
    vi.mocked(getCurrentSubscription).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSubscriptionData());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subscription).toBeNull();
    expect(result.current.error).toMatch(/algo deu errado|boom/i);
  });

  it("refresh re-fetches and updates state", async () => {
    vi.mocked(getCurrentSubscription)
      .mockResolvedValueOnce(sample)
      .mockResolvedValueOnce({ ...sample, status: "past_due" });

    const { result } = renderHook(() => useSubscriptionData());
    await waitFor(() => expect(result.current.subscription).toBeTruthy());
    expect(result.current.subscription.status).toBe("active");

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.subscription.status).toBe("past_due");
    expect(getCurrentSubscription).toHaveBeenCalledTimes(2);
  });
});
