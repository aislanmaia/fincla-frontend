// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BillingPanel } from "../BillingPanel.jsx";

vi.mock("../../../../api/subscriptions", () => ({
  getCurrentSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  changePlan: vi.fn(),
}));
vi.mock("../../../../api/plans", () => ({
  listPlans: vi.fn(),
}));

import { getCurrentSubscription } from "../../../../api/subscriptions";
import { listPlans } from "../../../../api/plans";

function SectionCard({ children }) {
  return <section data-testid="section-card">{children}</section>;
}
function SectionHeader({ title, sub }) {
  return (
    <header>
      <h3>{title}</h3>
      <p>{sub}</p>
    </header>
  );
}

const baseSubscription = {
  id: "sub_uuid",
  plan: {
    id: "essential",
    name: "Essential",
    description: "Plano essencial para começar",
    audience: "standard",
    monthly_price_cents: 3990,
    yearly_price_cents: 39900,
    max_organizations: 1,
    max_users_per_org: 2,
    features: [
      "manual_transactions",
      "recurring_transactions",
      "whatsapp_assistant",
    ],
    display_order: 10,
  },
  status: "active",
  billing_cycle: "monthly",
  gateway_provider: "manual",
  current_period_start: null,
  current_period_end: "2026-06-18T00:00:00",
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
      invoice_url: "https://asaas/i/inv_1",
      pdf_url: "https://asaas/p/inv_1.pdf",
      description: "Maio/2026",
    },
  ],
};

beforeEach(() => {
  vi.mocked(getCurrentSubscription).mockReset();
  vi.mocked(listPlans).mockReset();
});
afterEach(cleanup);

describe("<BillingPanel>", () => {
  it("renders the fallback when dataMode is not live", () => {
    render(
      <BillingPanel
        SectionCard={SectionCard}
        SectionHeader={SectionHeader}
        dataMode="empty"
      />,
    );
    expect(
      screen.getByText(/faça login para ver os detalhes/i),
    ).toBeInTheDocument();
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });

  it("renders plan name, status badge and friendly feature labels", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue(baseSubscription);

    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Essential")).toBeInTheDocument(),
    );

    expect(screen.getByText("Plano essencial para começar")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();

    // Feature chips render friendly PT labels, not raw keys.
    expect(screen.queryByText("manual_transactions")).not.toBeInTheDocument();
    expect(screen.getByText("Transações ilimitadas")).toBeInTheDocument();
    expect(screen.getByText("Recorrências e orçamentos")).toBeInTheDocument();
    expect(screen.getByText("Bot do WhatsApp")).toBeInTheDocument();
  });

  it("shows the cancel banner when cancel_at_period_end is true", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue({
      ...baseSubscription,
      cancel_at_period_end: true,
    });

    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/sua assinatura termina em/i),
    ).toBeInTheDocument();
    // Cancel button should be hidden — already cancelling.
    expect(
      screen.queryByRole("button", { name: /cancelar assinatura/i }),
    ).not.toBeInTheDocument();
  });

  it("lists recent invoices with status and links", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue(baseSubscription);
    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );

    await waitFor(() =>
      expect(screen.getByText("Maio/2026")).toBeInTheDocument(),
    );
    expect(screen.getByText(/paga/i)).toBeInTheDocument();
    expect(screen.getByTitle("Abrir fatura")).toHaveAttribute(
      "href",
      "https://asaas/i/inv_1",
    );
    expect(screen.getByTitle("Baixar PDF")).toHaveAttribute(
      "href",
      "https://asaas/p/inv_1.pdf",
    );
  });

  it("opens the PlansComparisonModal when 'Trocar plano' is clicked", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue(baseSubscription);
    vi.mocked(listPlans).mockResolvedValue([baseSubscription.plan]);

    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /trocar plano/i })).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /trocar plano/i }),
    );

    expect(
      await screen.findByRole("dialog", { name: /comparar planos/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty-state when there are no recent invoices", async () => {
    vi.mocked(getCurrentSubscription).mockResolvedValue({
      ...baseSubscription,
      recent_invoices: [],
    });
    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );
    await waitFor(() =>
      expect(screen.getByText(/nenhuma fatura emitida/i)).toBeInTheDocument(),
    );
  });

  it("renders the error state with a retry button when the backend fails", async () => {
    vi.mocked(getCurrentSubscription).mockRejectedValue(new Error("kaboom"));

    render(
      <BillingPanel SectionCard={SectionCard} SectionHeader={SectionHeader} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /tentar novamente/i }),
      ).toBeInTheDocument(),
    );
  });
});
