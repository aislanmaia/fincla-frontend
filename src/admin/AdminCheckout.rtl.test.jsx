// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminStuckCheckoutAccounts: vi.fn(),
  getAdminUserCheckoutEvents: vi.fn(),
  getAdminCheckoutEvents: vi.fn(),
}));

vi.mock("../api/admin", () => ({
  getAdminStuckCheckoutAccounts: mocks.getAdminStuckCheckoutAccounts,
  getAdminUserCheckoutEvents: mocks.getAdminUserCheckoutEvents,
  getAdminCheckoutEvents: mocks.getAdminCheckoutEvents,
}));

import { AdminCheckout, noEventsLabel, reasonLabel } from "./AdminCheckout.jsx";

const STUCK_LEAD = {
  user_id: "user-lead",
  email: "lead@example.com",
  first_name: "Maria",
  account_created_at: "2026-11-01T12:00:00",
  subscription_status: "pending_payment",
  billing_cycle: "monthly",
  gateway_customer_id: "cus_lead",
  problem_count: 2,
  last_event: { id: "e3", event_type: "account_resumed", severity: "info", reason: null, created_at: "2026-11-01T12:10:00" },
  last_problem: { id: "e2", event_type: "charge_declined", severity: "problem", reason: "asaas_card_declined", created_at: "2026-11-01T12:05:00" },
};
const OLD_ACCOUNT = {
  user_id: "user-old",
  email: "old@example.com",
  first_name: null,
  account_created_at: "2026-10-30T17:28:26",
  subscription_status: "pending_payment",
  billing_cycle: "monthly",
  gateway_customer_id: "cus_old",
  problem_count: 0,
  last_event: null,
  last_problem: null,
};
const TIMELINE = [
  { id: "e2", event_type: "charge_declined", severity: "problem", reason: "asaas_card_declined", created_at: "2026-11-01T12:05:00", details: { status_code: 400, error_code: "invalid_creditCard", message: "Transação não autorizada." } },
  { id: "e1", event_type: "account_created", severity: "info", reason: null, created_at: "2026-11-01T12:00:00", details: { plan: "pro" } },
];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminStuckCheckoutAccounts.mockResolvedValue({ items: [STUCK_LEAD, OLD_ACCOUNT] });
  mocks.getAdminUserCheckoutEvents.mockResolvedValue({ items: TIMELINE });
  mocks.getAdminCheckoutEvents.mockResolvedValue({ items: [] });
});

describe("checkout no painel administrativo", () => {
  it("lista as contas sem pagamento com o último problema, e as anteriores ao diário sem inventar motivo", async () => {
    render(<AdminCheckout />);

    const lead = await screen.findByRole("button", { name: /Maria/ });
    expect(within(lead).getByText("Cobrança recusada")).toBeInTheDocument();
    expect(within(lead).getByText(/Cartão recusado pelo Asaas/)).toBeInTheDocument();
    expect(within(lead).getByText("2 problemas")).toBeInTheDocument();

    const old = screen.getByRole("button", { name: /old@example.com/ });
    expect(within(old).getByText(/Criada antes do diário/)).toBeInTheDocument();
    expect(within(old).getByText("Sem problemas")).toBeInTheDocument();
    expect(mocks.getAdminStuckCheckoutAccounts).toHaveBeenCalledWith({ only_problems: undefined, limit: 100 });
  });

  it("filtra só as contas com problema", async () => {
    render(<AdminCheckout />);
    await screen.findByRole("button", { name: /Maria/ });

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar contas sem pagamento" }));
    fireEvent.click(screen.getByRole("option", { name: "Só com problema" }));

    await waitFor(() => expect(mocks.getAdminStuckCheckoutAccounts).toHaveBeenLastCalledWith({ only_problems: true, limit: 100 }));
  });

  it("abre a linha do tempo da conta com o motivo exato e o trecho técnico", async () => {
    render(<AdminCheckout />);
    fireEvent.click(await screen.findByRole("button", { name: /Maria/ }));

    const timeline = await screen.findByRole("list", { name: "Linha do tempo do checkout" });
    const [declined, created] = within(timeline).getAllByRole("listitem");
    expect(mocks.getAdminUserCheckoutEvents).toHaveBeenCalledWith("user-lead");
    expect(within(declined).getByText("Cobrança recusada")).toBeInTheDocument();
    expect(within(declined).getByText("Problema")).toBeInTheDocument();
    expect(within(declined).getByText("asaas_card_declined")).toBeInTheDocument();
    expect(within(declined).getByText(/"error_code": "invalid_creditCard"/)).toBeInTheDocument();
    expect(declined.querySelector("details").open).toBe(true);
    expect(within(created).getByText("Conta criada")).toBeInTheDocument();
    expect(created.querySelector("details").open).toBe(false);
    expect(screen.getByText("cus_lead")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Voltar para o checkout/ }));
    expect(await screen.findByRole("button", { name: /Maria/ })).toBeInTheDocument();
  });

  it("explica a linha do tempo vazia de uma conta anterior ao diário", async () => {
    mocks.getAdminUserCheckoutEvents.mockResolvedValue({ items: [] });
    render(<AdminCheckout />);
    fireEvent.click(await screen.findByRole("button", { name: /old@example.com/ }));

    expect(await screen.findByText(/foi criada antes do diário existir/)).toBeInTheDocument();
  });

  it("mostra os problemas recentes, inclusive os de quem nem chegou a criar conta", async () => {
    mocks.getAdminCheckoutEvents.mockResolvedValue({
      items: [
        { id: "p2", user_id: null, email: null, event_type: "registration_failed", severity: "problem", reason: "invalid_offer", created_at: "2026-11-01T13:00:00", details: {} },
        { id: "p1", user_id: "user-lead", email: "lead@example.com", event_type: "registration_refused", severity: "problem", reason: "password_mismatch", created_at: "2026-11-01T12:30:00", details: {} },
      ],
    });
    render(<AdminCheckout />);
    await screen.findByRole("button", { name: /Maria/ });

    fireEvent.click(screen.getByRole("tab", { name: "Problemas recentes" }));

    expect(await screen.findByText("E-mail não informado")).toBeInTheDocument();
    expect(mocks.getAdminCheckoutEvents).toHaveBeenCalledWith({ severity: "problem", limit: 100 });
    expect(screen.getByText("Antes de criar a conta").closest("button")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /lead@example.com/ }));
    expect(await screen.findByRole("list", { name: "Linha do tempo do checkout" })).toBeInTheDocument();
    expect(mocks.getAdminUserCheckoutEvents).toHaveBeenCalledWith("user-lead");
  });

  it("mostra o erro da API sem esconder a tela", async () => {
    mocks.getAdminStuckCheckoutAccounts.mockRejectedValue({ response: { status: 500, data: { detail: "Falha interna" } } });
    render(<AdminCheckout />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
  });
});

describe("conta sem eventos no diário", () => {
  it("diferencia a conta anterior ao diário da que parou sem registrar passo", () => {
    expect(noEventsLabel({ account_created_at: "2026-10-30T17:28:26" })).toMatch(/^Criada antes do diário/);
    expect(noEventsLabel({ account_created_at: "2026-11-01T02:51:09" })).toMatch(/^Criada antes do diário/);
    expect(noEventsLabel({ account_created_at: "2026-11-01T02:51:11" })).toBe("Nenhum passo registrado no diário");
  });
});

describe("rótulos dos motivos", () => {
  it("traduz os motivos com prefixo e mantém o código desconhecido", () => {
    expect(reasonLabel("subscription_active")).toBe("Assinatura ativa");
    expect(reasonLabel("gateway_manual")).toBe("Cobrança por outro provedor (manual)");
    expect(reasonLabel("password_mismatch")).toBe("Senha diferente da cadastrada");
    expect(reasonLabel("brand_new_reason")).toBe("brand_new_reason");
    expect(reasonLabel(null)).toBeNull();
  });
});
