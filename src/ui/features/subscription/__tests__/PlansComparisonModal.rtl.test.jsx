// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlansComparisonModal } from "../PlansComparisonModal.jsx";

vi.mock("../../../../api/plans", () => ({
  listPlans: vi.fn(),
}));
vi.mock("../../../../api/subscriptions", () => ({
  changePlan: vi.fn(),
}));

import { listPlans } from "../../../../api/plans";
import { changePlan } from "../../../../api/subscriptions";

const essential = {
  id: "essential",
  name: "Essential",
  description: "Plano essencial",
  audience: "standard",
  monthly_price_cents: 3990,
  yearly_price_cents: 39900,
  max_organizations: 1,
  max_users_per_org: 2,
  features: [
    "manual_transactions",
    "recurring_transactions",
    "whatsapp_assistant",
    "csv_export",
  ],
  display_order: 10,
};
const pro = {
  ...essential,
  id: "pro",
  name: "Pro",
  description: "Plano Pro",
  monthly_price_cents: 5490,
  yearly_price_cents: 54900,
  max_users_per_org: 10,
  features: [
    ...essential.features,
    "advanced_reports",
    "what_if_simulations",
    "ai_categorization",
    "ai_insights",
    "ai_anomaly_detection",
    "ai_predictive_reports",
  ],
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

    const essentialButton = screen.getByTestId("plan-select-essential");
    expect(essentialButton).toBeDisabled();
    expect(essentialButton).toHaveTextContent(/plano atual/i);

    const proButton = screen.getByTestId("plan-select-pro");
    expect(proButton).not.toBeDisabled();
    expect(proButton).toHaveTextContent(/fazer upgrade/i);
  });

  it("shows monthly price by default and the yearly hint", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    render(<PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Essential")).toBeInTheDocument());

    expect(screen.getByText(/R\$\s?39,90/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?54,90/)).toBeInTheDocument();
    expect(screen.getAllByText(/-17%/).length).toBeGreaterThan(0);
  });

  it("switches to yearly prices when the user toggles the cycle", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    render(<PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Essential")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("tab", { name: /anual/i }));

    expect(screen.getByText(/R\$\s?399,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?549,00/)).toBeInTheDocument();
    // Equivalência mensal aparece no modo anual
    expect(screen.getAllByText(/equivale a/i).length).toBeGreaterThan(0);
  });

  it("sends the currently selected billing cycle to changePlan", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    vi.mocked(changePlan).mockResolvedValue({
      subscription_id: "sub_x",
      target_plan_id: "pro",
      status: "pending_payment",
      checkout_url: "https://asaas/i/abc",
    });

    const originalLocation = window.location;
    delete window.location;
    window.location = { ...originalLocation, href: "" };

    render(<PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("plan-select-pro")).toBeInTheDocument(),
    );

    // Switch to yearly, then click Pro
    await userEvent.click(screen.getByRole("tab", { name: /anual/i }));
    await userEvent.click(screen.getByTestId("plan-select-pro"));

    await waitFor(() => {
      expect(changePlan).toHaveBeenCalledWith({
        target_plan_id: "pro",
        billing_cycle: "yearly",
      });
    });
    expect(window.location.href).toBe("https://asaas/i/abc");

    window.location = originalLocation;
  });

  it("renders friendly labels grouped by category with ✓/✗ alignment", async () => {
    vi.mocked(listPlans).mockResolvedValue([essential, pro]);
    render(<PlansComparisonModal currentPlanId="essential" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Essential")).toBeInTheDocument());

    // Friendly labels rendered, not raw feature keys.
    expect(screen.queryByText("manual_transactions")).not.toBeInTheDocument();
    expect(screen.getAllByText("Transações ilimitadas").length).toBe(2);
    expect(screen.getAllByText("Relatórios avançados").length).toBe(2);

    // Group headers visible.
    expect(screen.getAllByText(/essenciais/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recursos avançados/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/inteligência artificial/i).length).toBeGreaterThan(0);

    // Essential card: "Relatórios avançados" should show the not-included icon.
    const essentialCard = screen
      .getByTestId("plan-select-essential")
      .closest("div").parentElement;
    expect(
      within(essentialCard).getAllByLabelText("não incluído").length,
    ).toBeGreaterThan(0);
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
