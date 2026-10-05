import { describe, expect, it } from "vitest";
import { accessCheckoutPath, accessState, expiringAccess } from "../accessState.js";

const now = new Date("2026-10-03T12:00:00Z").getTime();

function account(subscription, extra = {}) {
  return { is_consultant: false, subscription: { plan: "pro", gateway_provider: "asaas", ...subscription }, ...extra };
}

describe("subscription access journey", () => {
  it("distinguishes an expired courtesy from an account ready for checkout", () => {
    const courtesy = account({ status: "pending_payment", is_entitled: false, courtesy_plan: "pro", courtesy_until: "2026-10-02T12:00:00Z" });
    expect(accessState(courtesy, null, now)).toBe("courtesy_ended");
    expect(accessState(account({ status: "pending_payment", is_entitled: false }), null, now)).toBe("checkout_required");
    expect(accessState(account({ status: "pending_payment", is_entitled: false }), { status: "pending_payment" }, now)).toBe("processing");
    expect(accessState(account({ status: "pending_payment", is_entitled: false }), { status: "declined" }, now)).toBe("payment_not_completed");
    expect(accessState(courtesy, { status: "declined" }, now)).toBe("payment_not_completed");
  });

  it("routes an ended paid subscription to reactivation, but a late charge to its existing invoice", () => {
    expect(accessState(account({ status: "cancelled", is_entitled: false }), { status: "cancelled" }, now)).toBe("ended");
    expect(accessState(account({ status: "past_due", is_entitled: false }), { status: "active" }, now)).toBe("past_due");
    expect(accessState(account({ status: "active", is_entitled: false, current_period_end: "2026-10-02T12:00:00Z" }), null, now)).toBe("past_due");
  });

  it("warns about a real access end and keeps beta and automatic paid renewals quiet", () => {
    const courtesy = account({ status: "pending_payment", is_entitled: true, courtesy_plan: "pro", courtesy_until: "2026-10-05T12:00:00Z" });
    expect(expiringAccess(courtesy.subscription, now)?.kind).toBe("courtesy");
    expect(expiringAccess({ ...courtesy.subscription, beta_enabled: true }, now)).toBeNull();
    expect(expiringAccess({ status: "active", is_entitled: true, current_period_end: "2026-10-05T12:00:00Z" }, now)).toBeNull();
  });

  it("keeps a consultant in the consultant purchase flow after access ends", () => {
    expect(accessCheckoutPath(account({ status: "cancelled" }, { is_consultant: true }))).toBe("/consultant-checkout");
  });
});
