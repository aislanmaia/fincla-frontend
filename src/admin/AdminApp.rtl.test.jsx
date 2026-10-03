// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminMe: vi.fn(),
  getAdminOverview: vi.fn(),
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
  getAdminCoupons: vi.fn(),
  createAdminCoupon: vi.fn(),
  disableAdminCoupon: vi.fn(),
  retryAdminCouponReprice: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/admin", () => ({ getAdminMe: mocks.getAdminMe, getAdminOverview: mocks.getAdminOverview, getAdminUsers: mocks.getAdminUsers, getAdminUser: mocks.getAdminUser, getAdminOrganizations: mocks.getAdminOrganizations, getAdminOrganization: mocks.getAdminOrganization, getAdminPlans: mocks.getAdminPlans, getAdminUserAudit: mocks.getAdminUserAudit, changeAdminUserAccess: mocks.changeAdminUserAccess, createAdminAccount: mocks.createAdminAccount, sendAdminPasswordReset: mocks.sendAdminPasswordReset, changeAdminBeta: mocks.changeAdminBeta, grantAdminCourtesy: mocks.grantAdminCourtesy, endAdminCourtesy: mocks.endAdminCourtesy, getAdminPlanRequests: mocks.getAdminPlanRequests, requestAdminPlanChange: mocks.requestAdminPlanChange, withdrawAdminPlanChange: mocks.withdrawAdminPlanChange, cancelAdminRenewal: mocks.cancelAdminRenewal, getAdminCoupons: mocks.getAdminCoupons, createAdminCoupon: mocks.createAdminCoupon, disableAdminCoupon: mocks.disableAdminCoupon, retryAdminCouponReprice: mocks.retryAdminCouponReprice }));
vi.mock("../api/auth", () => ({ login: mocks.login, logout: mocks.logout }));

import { AdminApp } from "./AdminApp.jsx";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.getAdminOverview.mockResolvedValue({ accounts: 2, organizations: 1, paid_active: 1, past_due: 1, blocked_accounts: 0, password_pending: 0, beta_active: 0, courtesy_active: 0, pending_plan_changes: 0, coupon_reprice_due: 0, coupons_active: 0, recent_accounts: [] });
  mocks.getAdminUsers.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  mocks.getAdminOrganizations.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  mocks.getAdminPlans.mockResolvedValue({ items: [] });
  mocks.getAdminCoupons.mockResolvedValue({ items: [] });
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

    expect(await screen.findByText("Atenção agora")).toBeInTheDocument();
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
    expect(screen.queryByText("Atenção agora")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
  });

  it("leva uma pendência do dashboard ao diretório filtrado e usa o seletor do admin", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });

    render(<AdminApp />);
    fireEvent.click(await screen.findByRole("button", { name: /Assinaturas em atraso/ }));
    await waitFor(() => expect(mocks.getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ status: "past_due" })));

    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por atenção" }));
    fireEvent.click(screen.getByRole("option", { name: "Bloqueadas" }));
    await waitFor(() => expect(mocks.getAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ status: "past_due", flag: "blocked" })));
  });

  it("permite pesquisar contas e abrir os detalhes de assinatura", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });
    mocks.getAdminUsers.mockResolvedValue({ items: [{ id: "user-1", email: "cliente@example.com", first_name: "Cliente", last_name: null, subscription: { plan: "pro", status: "active" } }], total: 1, limit: 20, offset: 0 });
    mocks.getAdminUser.mockResolvedValue({ id: "user-1", email: "cliente@example.com", first_name: "Cliente", last_name: null, created_at: "2026-01-01", onboarding_completed: true, password_pending: false, subscription: { plan: "pro", status: "active", billing_cycle: "monthly", gateway_provider: "manual", current_period_start: null, current_period_end: null, cancel_at_period_end: false, cancelled_at: null }, organizations: [], invoices: [] });

    render(<AdminApp />);
    expect(await screen.findByText("Atenção agora")).toBeInTheDocument();
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
    expect(await screen.findByText("Atenção agora")).toBeInTheDocument();
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
    mocks.getAdminUser.mockResolvedValue({ id: "paid-1", email: "paga@example.com", first_name: null, last_name: null, created_at: "2026-01-01", onboarding_completed: true, password_pending: false, blocked_at: null, organizations: [], invoices: [], subscription: { plan: "pro", status: "active", billing_cycle: "monthly", gateway_provider: "asaas", gateway_subscription_id: "sub_test", current_period_start: "2026-09-01", current_period_end: "2026-11-01", cancel_at_period_end: false, cancelled_at: null, beta_enabled: false, courtesy_plan: null, courtesy_until: null, coupon_reprice_due: true } });
    mocks.getAdminPlanRequests.mockResolvedValue({ items: [{ id: "change-1", current_plan: "pro", target_plan: "essential", target_cycle: "monthly", state: "pending_manual", reason: "Cliente solicitou", created_at: "2026-10-01" }] });

    render(<AdminApp />);
    expect(await screen.findByText("Atenção agora")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Contas" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /paga@example.com/ }));
    expect(await screen.findByText("Mudança pendente de execução")).toBeInTheDocument();
    expect(screen.getByText(/O plano atual continua ativo/)).toBeInTheDocument();
    expect(screen.getByText("pro", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Atualização de preço pendente")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo", { selector: "textarea#admin-reprice-reason" }), { target: { value: "Reprocessar preço" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar preço normal" }));
    await waitFor(() => expect(mocks.retryAdminCouponReprice).toHaveBeenCalledWith("paid-1", "Reprocessar preço"));
  });

  it("cria cupom com plano, ciclo, limite e duração definidos pelo administrador", async () => {
    localStorage.setItem("auth_token", "admin-token");
    mocks.getAdminMe.mockResolvedValue({ id: "admin-1", email: "aislan.sousamaia@gmail.com", is_admin: true });
    mocks.createAdminCoupon.mockResolvedValue({ id: "coupon-1", code: "PRIMEIRA10" });
    render(<AdminApp />);
    expect(await screen.findByText("Atenção agora")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Cupons" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Criar cupom" }));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "primeira10" } });
    fireEvent.change(screen.getByLabelText("Máximo de usos (opcional)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Cobranças com desconto"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Campanha de lançamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar cupom" }));
    await waitFor(() => expect(mocks.createAdminCoupon).toHaveBeenCalledWith(expect.objectContaining({
      code: "PRIMEIRA10", eligible_plans: ["pro"], eligible_cycles: ["monthly"],
      max_uses: 30, discounted_charges: 2, reason: "Campanha de lançamento",
    })));
  });
});
