// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../../api/checkout", () => ({ currentCheckout: vi.fn() }));
vi.mock("../../api/subscriptions", () => ({ getCurrentSubscription: vi.fn() }));
vi.mock("../../api/auth", () => ({ changePassword: vi.fn() }));

import { currentCheckout } from "../../api/checkout";
import { getCurrentSubscription } from "../../api/subscriptions";
import { AccessPage } from "./AccessPage.jsx";

function session(subscription, role = "owner") {
  return {
    user: { email: "maria@example.com", role, is_consultant: false, subscription: { plan: "pro", gateway_provider: "asaas", ...subscription } },
    refreshAccess: vi.fn().mockResolvedValue(null),
    signOut: vi.fn(),
  };
}

beforeEach(() => {
  navigate.mockReset();
  vi.mocked(currentCheckout).mockReset().mockResolvedValue(null);
  vi.mocked(getCurrentSubscription).mockReset().mockResolvedValue({
    plan: { name: "Fincla Pessoal" }, recent_invoices: [], status: "pending_payment",
  });
});
afterEach(cleanup);

it("takes an expired courtesy to a first explicit subscription", async () => {
  const activeSession = session({ status: "pending_payment", is_entitled: false, courtesy_plan: "pro", courtesy_until: "2026-01-01T00:00:00" });
  render(<AccessPage session={activeSession} />);
  expect(await screen.findByRole("heading", { name: "Sua cortesia chegou ao fim." })).toBeInTheDocument();
  expect(screen.getByText("A cortesia não gera cobrança automática.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Escolher um plano/ }));
  expect(navigate).toHaveBeenCalledWith({ to: "/checkout" });
  await waitFor(() => expect(activeSession.refreshAccess).toHaveBeenCalled());
});

it("opens checkout directly for an account without access or a payment attempt", async () => {
  render(<AccessPage session={session({ status: "pending_payment", is_entitled: false })} />);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/checkout", replace: true }));
  expect(screen.queryByRole("heading", { name: /Primeira assinatura/i })).toBeNull();
});

it("describes a declined checkout as an unfinished payment and offers another attempt", async () => {
  vi.mocked(currentCheckout).mockResolvedValue({ status: "declined" });
  render(<AccessPage session={session({ status: "pending_payment", is_entitled: false })} />);
  expect(await screen.findByRole("heading", { name: "Seu pagamento não foi concluído." })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
  expect(navigate).toHaveBeenCalledWith({ to: "/checkout" });
});

it("sends an overdue account to its existing invoice instead of a new checkout", async () => {
  vi.mocked(getCurrentSubscription).mockResolvedValue({
    plan: { name: "Fincla Pessoal" }, status: "past_due", recent_invoices: [{ id: "invoice-1", status: "overdue", amount_cents: 2990, due_date: "2026-09-01", invoice_url: "https://example.test/fatura" }],
  });
  const opened = vi.spyOn(window, "open").mockImplementation(() => null);
  render(<AccessPage session={session({ status: "past_due", is_entitled: false })} />);
  await screen.findByRole("heading", { name: "Vamos regularizar sua assinatura." });
  fireEvent.click(screen.getByRole("button", { name: /Abrir fatura/ }));
  expect(opened).toHaveBeenCalledWith("https://example.test/fatura", "_blank", "noopener,noreferrer");
  expect(navigate).not.toHaveBeenCalled();
  opened.mockRestore();
});

it("shows a member who to contact without offering a payment action", async () => {
  vi.mocked(getCurrentSubscription).mockResolvedValue({ plan: { name: "Fincla Pessoal" }, status: "expired", recent_invoices: [] });
  render(<AccessPage session={session({ status: "expired", is_entitled: false }, "member")} />);
  expect(await screen.findByText("Peça ao responsável pela assinatura para regularizar o acesso.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reativar assinatura/ })).toBeNull();
});

it("explains a courtesy before expiry without suggesting an automatic charge", async () => {
  const courtesyUntil = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  vi.mocked(getCurrentSubscription).mockResolvedValue({ plan: { name: "Fincla Pessoal" }, status: "pending_payment", is_entitled: true, courtesy_plan: "pro", courtesy_until: courtesyUntil, recent_invoices: [] });
  render(<AccessPage session={session({ status: "pending_payment", is_entitled: true, courtesy_plan: "pro", courtesy_until: courtesyUntil })} />);
  expect(await screen.findByRole("heading", { name: "Sua cortesia está perto do fim." })).toBeInTheDocument();
  expect(screen.getByText("A cortesia não gera cobrança automática.")).toBeInTheDocument();
  expect(screen.queryByText("Sua assinatura está em dia.")).toBeNull();
  expect(screen.queryByRole("button", { name: /Escolher um plano/ })).toBeNull();
});
