import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  updateMyProfile: vi.fn(),
  getMyOrganizations: vi.fn(),
  createRecurringSeries: vi.fn(),
  createCreditCard: vi.fn(),
  listTags: vi.fn(),
  updateTag: vi.fn(),
  createOrganizationInvitations: vi.fn(),
  updateOrganization: vi.fn(),
  listRecurringSeries: vi.fn(),
  formatOnboardingApiError: vi.fn((error) => String(error)),
}));

vi.mock("../../../data/onboardingAdapter", () => ({
  createOrganization: mocks.createOrganization,
  updateMyProfile: mocks.updateMyProfile,
  getMyOrganizations: mocks.getMyOrganizations,
  createRecurringSeries: mocks.createRecurringSeries,
  createCreditCard: mocks.createCreditCard,
  listTags: mocks.listTags,
  updateTag: mocks.updateTag,
  createOrganizationInvitations: mocks.createOrganizationInvitations,
  updateOrganization: mocks.updateOrganization,
  listRecurringSeries: mocks.listRecurringSeries,
  formatOnboardingApiError: mocks.formatOnboardingApiError,
}));

import { submitOnboarding } from "../onboardingApi.js";

const tagType = { id: "tt-cat", name: "categoria" };

describe("submitOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T12:00:00Z"));

    mocks.createOrganization.mockResolvedValue({
      organization: { id: "org-1", name: "Casa", org_type: "couple" },
    });
    mocks.updateMyProfile.mockResolvedValue({});
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [{ organization: { id: "org-1", name: "Casa", org_type: "couple" } }],
      total: 1,
    });
    mocks.createRecurringSeries.mockResolvedValue({ id: "rt-1" });
    mocks.createCreditCard.mockResolvedValue({ id: 1 });
    mocks.listTags.mockResolvedValue({
      tags: [
        {
          id: "t-home",
          name: "Housing",
          icon_key: "home",
          color: "#111",
          sort_order: 9,
          tag_type: tagType,
          parent_category_tag_id: null,
        },
        {
          id: "t-food",
          name: "Food & Groceries",
          icon_key: "shopping-cart",
          color: "#222",
          sort_order: 0,
          tag_type: tagType,
          parent_category_tag_id: null,
        },
        {
          id: "t-car",
          name: "Transport",
          icon_key: "car",
          color: "#333",
          sort_order: 1,
          tag_type: tagType,
          parent_category_tag_id: null,
        },
      ],
    });
    mocks.updateTag.mockResolvedValue({ id: "t-x" });
    mocks.createOrganizationInvitations.mockResolvedValue({ invitations: [] });
    mocks.updateOrganization.mockResolvedValue({ id: "org-1", name: "Casa" });
    mocks.listRecurringSeries.mockResolvedValue({ series: [] });
  });

  it("persiste a receita recorrente configurada no onboarding", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temRec: "sim",
      recDesc: "Salário",
      recVal: "2200,00",
      recDia: "10",
      recTipo: "fixo",
    });

    expect(mocks.updateMyProfile).toHaveBeenCalledWith({
      onboarding_completed: true,
    });
    expect(mocks.createRecurringSeries).toHaveBeenCalledWith("org-1", {
      type: "income",
      description: "Salário",
      value: 2200,
      payment_method: "pix",
      frequency: "monthly",
      start_date: "2026-03-24",
      day_of_month: 10,
      value_kind: "exact",
      category: "Receita",
    });
  });

  it("persiste o cartão configurado no onboarding", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temCartao: "sim",
      cardNome: "Nubank Roxinho",
      card4: "1234",
      cardLim: "5.000,00",
      cardVenc: "10",
      temRec: "nao",
    });

    expect(mocks.createCreditCard).toHaveBeenCalledWith({
      organization_id: "org-1",
      last4: "1234",
      brand: "Nubank Roxinho",
      due_day: 10,
      description: "Nubank Roxinho",
      credit_limit: 5000,
      closing_day: undefined,
      color: undefined,
    });
  });

  it("atualiza apenas tags de categoria já seedadas (PATCH), por icon_key", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      cats: ["moradia", "alimentacao", "transporte"],
      temRec: "nao",
      temCartao: "nao",
    });

    expect(mocks.listTags).toHaveBeenCalledWith("org-1", "categoria");
    expect(mocks.updateTag).toHaveBeenCalledTimes(3);
    expect(mocks.updateTag).toHaveBeenNthCalledWith(1, "t-home", {
      name: "Housing",
      tag_type_id: "tt-cat",
      color: "#111",
      icon_key: "home",
      parent_category_tag_id: null,
      sort_order: 0,
      is_onboarding_highlight: true,
    });
    expect(mocks.updateTag).toHaveBeenNthCalledWith(2, "t-food", {
      name: "Food & Groceries",
      tag_type_id: "tt-cat",
      color: "#222",
      icon_key: "shopping-cart",
      parent_category_tag_id: null,
      sort_order: 1,
      is_onboarding_highlight: true,
    });
    expect(mocks.updateTag).toHaveBeenNthCalledWith(3, "t-car", {
      name: "Transport",
      tag_type_id: "tt-cat",
      color: "#333",
      icon_key: "car",
      parent_category_tag_id: null,
      sort_order: 2,
      is_onboarding_highlight: true,
    });
  });

  it("marca onboarding como concluído apenas depois de persistir as demais etapas", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      cats: ["moradia"],
      temRec: "sim",
      recDesc: "Salário",
      recVal: "2200,00",
      recDia: "10",
      temCartao: "sim",
      cardNome: "Nubank Roxinho",
      card4: "1234",
      cardLim: "5.000,00",
      cardVenc: "10",
    });

    const profileCallOrder = mocks.updateMyProfile.mock.invocationCallOrder[0];
    const createOrgCallOrder = mocks.createOrganization.mock.invocationCallOrder[0];
    const recurringCallOrder = mocks.createRecurringSeries.mock.invocationCallOrder[0];
    const creditCardCallOrder = mocks.createCreditCard.mock.invocationCallOrder[0];
    const categoryCallOrder = mocks.updateTag.mock.invocationCallOrder[0];

    expect(mocks.createOrganization).toHaveBeenCalledWith({
      name: "Casa",
      description: expect.any(String),
      org_type: "couple",
      monthly_income: 2200,
    });

    expect(profileCallOrder).toBeGreaterThan(createOrgCallOrder);
    expect(profileCallOrder).toBeGreaterThan(recurringCallOrder);
    expect(profileCallOrder).toBeGreaterThan(creditCardCallOrder);
    expect(profileCallOrder).toBeGreaterThan(categoryCallOrder);
  });

  it("envia convites por e-mail após criar a organização e antes de marcar onboarding concluído", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temRec: "nao",
      temCartao: "nao",
      membros: ["  Ana@Exemplo.com ", "ana@exemplo.com", "bob@teste.org"],
    });

    expect(mocks.createOrganizationInvitations).toHaveBeenCalledWith("org-1", [
      "ana@exemplo.com",
      "bob@teste.org",
    ]);

    const profileOrder = mocks.updateMyProfile.mock.invocationCallOrder[0];
    const inviteOrder = mocks.createOrganizationInvitations.mock.invocationCallOrder[0];
    expect(profileOrder).toBeGreaterThan(inviteOrder);
  });

  it("nao cria cartao quando os 4 digitos nao foram informados", async () => {
    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temCartao: "sim",
      cardNome: "Nubank Roxinho",
      card4: "12",
      cardLim: "5.000,00",
      cardVenc: "10",
      temRec: "nao",
    });

    expect(mocks.createCreditCard).not.toHaveBeenCalled();
    expect(mocks.updateMyProfile).toHaveBeenCalledWith({ onboarding_completed: true });
  });

  it("reusa a organizacao de uma tentativa anterior em vez de criar outra", async () => {
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [
        {
          organization: { id: "org-antiga", name: "Casa", created_at: "2026-08-20T01:11:41" },
          membership: { id: "m-1", role: "owner", created_at: "2026-08-20T01:11:41" },
        },
      ],
      total: 1,
    });
    mocks.updateOrganization.mockResolvedValue({ id: "org-antiga", name: "Casa Nova" });

    const result = await submitOnboarding({
      orgNome: "Casa Nova",
      orgTipo: "couple",
      temRec: "nao",
      temCartao: "nao",
    });

    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.updateOrganization).toHaveBeenCalledWith(
      "org-antiga",
      expect.objectContaining({ name: "Casa Nova", org_type: "couple" }),
    );
    expect(result.activeOrgId).toBe("org-antiga");
  });

  it("reusa a organizacao mais recente quando ha varias de tentativas anteriores", async () => {
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [
        {
          organization: { id: "org-1a", name: "Casa", created_at: "2026-08-20T01:11:41" },
          membership: { id: "m-1", role: "owner", created_at: "2026-08-20T01:11:41" },
        },
        {
          organization: { id: "org-2a", name: "Casa", created_at: "2026-08-20T01:15:33" },
          membership: { id: "m-2", role: "owner", created_at: "2026-08-20T01:15:33" },
        },
      ],
      total: 2,
    });

    await submitOnboarding({ orgNome: "Casa", orgTipo: "couple", temRec: "nao", temCartao: "nao" });

    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.updateOrganization).toHaveBeenCalledWith("org-2a", expect.anything());
  });

  it("ignora organizacao em que o usuario nao e owner", async () => {
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [
        {
          organization: { id: "org-de-terceiro", name: "Time", created_at: "2026-08-01T10:00:00" },
          membership: { id: "m-9", role: "member", created_at: "2026-08-01T10:00:00" },
        },
      ],
      total: 1,
    });

    await submitOnboarding({ orgNome: "Casa", orgTipo: "couple", temRec: "nao", temCartao: "nao" });

    expect(mocks.createOrganization).toHaveBeenCalled();
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  it("conclui o onboarding mesmo quando o cartao falha, e devolve o aviso", async () => {
    mocks.createCreditCard.mockRejectedValue(new Error("422"));

    const result = await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temCartao: "sim",
      cardNome: "Nubank Roxinho",
      card4: "1234",
      cardLim: "5.000,00",
      cardVenc: "10",
      temRec: "nao",
    });

    expect(mocks.updateMyProfile).toHaveBeenCalledWith({ onboarding_completed: true });
    expect(result.warnings).toEqual(["Não foi possível salvar o cartão."]);
  });

  it("conclui o onboarding mesmo quando as categorias falham", async () => {
    mocks.listTags.mockRejectedValue(new Error("500"));

    const result = await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      cats: ["moradia"],
      temRec: "nao",
      temCartao: "nao",
    });

    expect(mocks.updateMyProfile).toHaveBeenCalledWith({ onboarding_completed: true });
    expect(result.warnings).toEqual(["Não foi possível destacar as categorias escolhidas."]);
  });

  it("nao duplica a receita recorrente ao reusar organizacao", async () => {
    mocks.getMyOrganizations.mockResolvedValue({
      organizations: [
        {
          organization: { id: "org-antiga", name: "Casa", created_at: "2026-08-20T01:11:41" },
          membership: { id: "m-1", role: "owner", created_at: "2026-08-20T01:11:41" },
        },
      ],
      total: 1,
    });
    mocks.listRecurringSeries.mockResolvedValue({
      series: [{ id: "rs-1", type: "income", description: "Salário" }],
    });

    await submitOnboarding({
      orgNome: "Casa",
      orgTipo: "couple",
      temRec: "sim",
      recDesc: "Salário",
      recVal: "12.000,00",
      recDia: "5",
      temCartao: "nao",
    });

    expect(mocks.createRecurringSeries).not.toHaveBeenCalled();
  });
});
