import { checkoutPersona } from "../auth/checkoutIdentity.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function accessDeadline(subscription, now = Date.now()) {
  if (!subscription || subscription.beta_enabled) return null;
  const courtesyEnd = subscription.courtesy_until ? new Date(subscription.courtesy_until).getTime() : NaN;
  if (subscription.courtesy_plan && Number.isFinite(courtesyEnd) && courtesyEnd > now && subscription.status !== "active") {
    return subscription.courtesy_until;
  }
  return subscription.cancel_at_period_end ? subscription.current_period_end ?? null : null;
}

export function expiringAccess(subscription, now = Date.now()) {
  const deadline = accessDeadline(subscription, now);
  if (!subscription?.is_entitled || !deadline) return null;
  const remaining = new Date(deadline).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 7 * DAY_MS) return null;
  return {
    deadline,
    kind: subscription.cancel_at_period_end ? "cancel_scheduled" : "courtesy",
  };
}

export function accessState(user, attempt, now = Date.now()) {
  const subscription = user?.subscription;
  if (!subscription) return "unknown";
  if (subscription.beta_enabled || subscription.is_entitled === true) return "active";
  if (subscription.gateway_provider === "sponsored") return "sponsored";
  if (subscription.status === "past_due") return "past_due";
  if (subscription.status === "cancelled" || subscription.status === "expired" ||
      (subscription.status === "active" && subscription.cancel_at_period_end && subscription.current_period_end && new Date(subscription.current_period_end).getTime() <= now)) {
    return "ended";
  }
  if (subscription.status === "active" && subscription.current_period_end && new Date(subscription.current_period_end).getTime() <= now) return "past_due";
  if (attempt && ["preparing", "processing", "reconciling", "pending_payment"].includes(attempt.status)) return "processing";
  if (attempt?.status === "declined" || attempt?.status === "cancelled") return "payment_not_completed";
  if (subscription.courtesy_plan && subscription.courtesy_until && new Date(subscription.courtesy_until).getTime() <= now) return "courtesy_ended";
  if (subscription.status === "pending_payment") return "checkout_required";
  return "unknown";
}

export function accessCheckoutPath(user) {
  return checkoutPersona(user) === "consultant" ? "/consultant-checkout" : "/checkout";
}
