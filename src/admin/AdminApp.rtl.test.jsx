// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminMe: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  getAdminOrganizations: vi.fn(),
  getAdminOrganization: vi.fn(),
  getAdminPlans: vi.fn(),
  getAdminUserAudit: vi.fn(),
  changeAdminUserAccess: vi.fn(),
  createAdminAccount: vi.fn(),
  sendAdminPasswordReset: vi.fn(),
  changeAdminBeta: vi.fn(),
  grantAdminCourtesy: vi.fn(),
  endAdminCourtesy: vi.fn(),
  getAdminPlanRequests: vi.fn(),
  requestAdminPlanChange: vi.fn(),
  withdrawAdminPlanChange: vi.fn(),
  cancelAdminRenewal: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/admin", () => ({ getAdminMe: mocks.getAdminMe, getAdminUsers: mocks.getAdminUsers, getAdminUser: mocks.getAdminUser, getAdminOrganizations: mocks.getAdminOrganizations, getAdminOrganization: mocks.getAdminOrganization, getAdminPlans: mocks.getAdminPlans, getAdminUserAudit: mocks.getAdminUserAudit, changeAdminUserAccess: mocks.changeAdminUserAccess, createAdminAccount: mocks.createAdminAccount, sendAdminPasswordReset: mocks.sendAdminPasswordReset, changeAdminBeta: mocks.changeAdminBeta, grantAdminCourtesy: mocks.grantAdminCourtesy, endAdminCourtesy: mocks.endAdminCourtesy, getAdminPlanRequests: mocks.getAdminPlanRequests, requestAdminPlanChange: mocks.requestAdminPlanChange, withdrawAdminPlanChange: mocks.withdrawAdminPlanChange, cancelAdminRenewal: mocks.cancelAdminRenewal }));
vi.mock("../api/auth", () => ({ login: mocks.login, logout: mocks.logout }));

import { AdminApp } from "./AdminApp.jsx";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.getAdminUsers.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  mocks.getAdminOrganizations.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  mocks.getAdminPlans.mockResolvedValue({ items: [] });
  mocks.getAdminPlanRequests.mockResolvedValue({ items: [] });
  mocks.getAdminUserAudit.mockResolvedValue({ items: [] });
  mocks.sendAdminPasswordReset.mockResolvedValue({ email_sent: true });
  mocks.changeAdminBeta.mockResolvedValue({ beta_enabled: true });
});

describe("painel do administrador Fincla", () => {
  it("mostra o painel somente após a API confirmar a permissão administrativa", async () => {
    mocks.login.mockImplementation(async () => {
      localStorage.setItem("auth_token", "admin-token");
    });
    mocks.getAdminMe.mockResolvedValue({
      id: "admin-1",
      email: "aislan.sousamaia@gmail.com",
      is_admin: true,
    });

    render(<AdminApp />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aislan.sousamaia@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(await screen.findByText("Acesso administrativo ativo")).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledWith("aislan.sousamaia@gmail.com", "senha-segura");
    fireEvent.click(screen.getAllByRole("button", { name: "Sair" })[1]);
    expect(mocks.logout).toHaveBeenCalled();
  });

  it("nega o painel ao proprietário sem permissão administrativa", async () => {
    mocks.login.mockImplementation(async () => {
      localStorage.setItem("auth_token", "owner-token");
    });
    mocks.getAdminMe.mockRejectedValue({ response: { status: 403 } });

    render(<AdminApp />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(await screen.findByText("Esta conta não tem acesso ao painel administrativo.")).toBeInTheDocument();
    expect(screen.queryByText("Acesso administrativo ativo")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
  });

  it("permite pesquisar contas e abrir os detalhes de assinatura", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });
    mocks.getAdminUsers.mockResolvedValue({ items: [{ id: "user-1", email: "cliente@example.com", first_name: "Cliente", last_name: null, subscription: { plan: "pro", status: "active" } }], total: 1, limit: 20, offset: 0 });
    mocks.getAdminUser.mockResolvedValue({ id: "user-1", email: "cliente@example.com", first_name: "Cliente", last_name: null, created_at: "2026-01-01", onboarding_completed: true, password_pending: false, subscription: { plan: "pro", status: "active", billing_cycle: "monthly", gateway_provider: "manual", current_period_start: null, current_period_end: null, cancel_at_period_end: false, cancelled_at: null }, organizations: [], invoices: [] });

    render(<AdminApp />);
    expect(await screen.findByText("Acesso administrativo ativo")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Contas" })[0]);
    expect(await screen.findByText("cliente@example.com")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar contas"), { target: { value: "cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(mocks.getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ q: "cliente" })));
    fireEvent.click(screen.getByRole("button", { name: /Cliente/ }));
    expect(await screen.findByText("Assinatura")).toBeInTheDocument();
    expect(mocks.getAdminUser).toHaveBeenCalledWith("user-1");
    fireEvent.click(screen.getByRole("button", { name: "Bloquear conta" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Solicitação de suporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.changeAdminUserAccess).toHaveBeenCalledWith("user-1", "block", "Solicitação de suporte"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar link de redefinição" }));
    fireEvent.change(screen.getByLabelText("Motivo", { selector: "textarea#admin-reset-reason" }), { target: { value: "Usuário esqueceu a senha" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar envio" }));
    await waitFor(() => expect(mocks.sendAdminPasswordReset).toHaveBeenCalledWith("user-1", "Usuário esqueceu a senha"));
    fireEvent.click(screen.getByRole("button", { name: "Ativar beta" }));
    fireEvent.change(screen.getByLabelText("Motivo", { selector: "textarea#admin-grant-reason" }), { target: { value: "Acesso para teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.changeAdminBeta).toHaveBeenCalledWith("user-1", true, "Acesso para teste"));
  });

  it("cria conta assistida sem exigir campos opcionais", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });
    mocks.createAdminAccount.mockResolvedValue({ user_id: "user-2", organization_id: "org-2", email_sent: true });
    mocks.getAdminUser.mockResolvedValue({ id: "user-2", email: "nova@example.com", first_name: "Nova", last_name: null, created_at: "2026-01-01", onboarding_completed: true, password_pending: true, blocked_at: null, subscription: null, organizations: [], invoices: [] });

    render(<AdminApp />);
    expect(await screen.findByText("Acesso administrativo ativo")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Contas" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Criar conta" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nova" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "nova@example.com" } });
    fireEvent.change(screen.getByLabelText("Organização"), { target: { value: "Família Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar e enviar convite" }));
    expect(await screen.findByText("Conta criada e convite enviado por e-mail.")).toBeInTheDocument();
    expect(mocks.createAdminAccount).toHaveBeenCalledWith(expect.objectContaining({ email: "nova@example.com", first_name: "Nova", organization_name: "Família Nova" }));
  });

  it("mostra mudança paga como pendente sem trocar o plano exibido", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });
    mocks.getAdminUsers.mockResolvedValue({ items: [{ id: "paid-1", email: "paga@example.com", first_name: null, last_name: null, subscription: { plan: "pro", status: "active" } }], total: 1, limit: 20, offset: 0 });
    mocks.getAdminUser.mockResolvedValue({ id: "paid-1", email: "paga@example.com", first_name: null, last_name: null, created_at: "2026-01-01", onboarding_completed: true, password_pending: false, blocked_at: null, organizations: [], invoices: [], subscription: { plan: "pro", status: "active", billing_cycle: "monthly", gateway_provider: "asaas", gateway_subscription_id: "sub_test", current_period_start: "2026-09-01", current_period_end: "2026-11-01", cancel_at_period_end: false, cancelled_at: null, beta_enabled: false, courtesy_plan: null, courtesy_until: null } });
    mocks.getAdminPlanRequests.mockResolvedValue({ items: [{ id: "change-1", current_plan: "pro", target_plan: "essential", target_cycle: "monthly", state: "pending_manual", reason: "Cliente solicitou", created_at: "2026-10-01" }] });

    render(<AdminApp />);
    expect(await screen.findByText("Acesso administrativo ativo")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Contas" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /paga@example.com/ }));
    expect(await screen.findByText("Mudança pendente de execução")).toBeInTheDocument();
    expect(screen.getByText(/O plano atual continua ativo/)).toBeInTheDocument();
    expect(screen.getByText("pro", { selector: "strong" })).toBeInTheDocument();
  });
});
