// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlansComparisonModal } from "../PlansComparisonModal.jsx";

vi.mock("../../../../api/plans.js", () => ({
  listPlans: vi.fn(),
}));
vi.mock("../../../../api/subscriptions.js", () => ({
  changePlan: vi.fn(),
}));

import { listPlans } from "../../../../api/plans.js";
import { changePlan } from "../../../../api/subscriptions.js";

const essential = {
  id: "essential",
  name: "Essential",
  description: "Plano essencial",
  audience: "standard",
  monthly_price_cents: 3990,
  yearly_price_cents: null,
  max_organizations: 1,
  max_users_per_org: 2,
  features: ["manual_transactions"],
  display_order: 10,
};
const pro = {
  ...essential,
  id: "pro",
  name: "Pro",
  description: "Plano Pro",
  monthly_price_cents: 5490,
  features: ["manual_transactions", "advanced_reports"],
  display_order: 20,
};

beforeEach(() => {
  vi.mocked(listPlans).mockReset();
  vi.mocked(changePlan).mockReset();
});

afterEach(cleanup);

describe("<PlansComparisonModal>", () => {
  it("renders plans coming from listPlans and marks current as disabled", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    render(
      <PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Essential")).toBeInTheDocument(),
    );
    expect(screen.getByText("Pro")).toBeInTheDocument();

    // The current-plan button is rendered as a disabled "Plano atual" affordance.
    const currentButton = screen.getByRole("button", { name: /plano atual/i });
    expect(currentButton).toBeDisabled();
    // The other plan has a "Selecionar" button.
    const selectButton = screen.getByRole("button", { name: /selecionar/i });
    expect(selectButton).not.toBeDisabled();
  });

  it("dispatches changePlan and redirects to checkout_url on select", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    vi.mocked(changePlan).mockResolvedValue({
      subscription_id: "sub_x",
      target_plan_id: "pro",
      status: "pending_payment",
      checkout_url: "https://asaas/i/abc",
    });

    // Stub window.location.href so we can assert the redirect without leaving jsdom.
    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: "" };

    render(
      <PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /selecionar/i })).toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /selecionar/i }),
    );

    await waitFor(() => {
      expect(changePlan).toHaveBeenCalledWith({
        target_plan_id: "pro",
        billing_cycle: "monthly",
      });
    });
    expect(window.location.href).toBe("https://asaas/i/abc");

    // Restore
    window.location = originalLocation;
  });

  it("renders backend error in the modal", async () => {
    vi.mocked(listPlans).mockRejectedValue(new Error("boom"));
    render(
      <PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />,
    );
    await waitFor(() => {
      expect(
        screen.getByText(/algo deu errado|boom/i),
      ).toBeInTheDocument();
    });
  });
});
