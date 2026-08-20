import {
  createCreditCard,
  createOrganization,
  createOrganizationInvitations,
  createRecurringSeries,
  formatOnboardingApiError,
  getMyOrganizations,
  listRecurringSeries,
  listTags,
  updateMyProfile,
  updateOrganization,
  updateTag,
} from "../../data/onboardingAdapter";
import { buildCreateCreditCardPayload } from "../../data/creditCardsAdapter.js";
import {
  buildOrganizationDescription,
  formatLocalIsoDate,
  parseMoneyInput,
} from "./onboardingValueUtils.js";
import { ONBOARDING_FLOW_TO_ICON_KEY } from "../../data/onboardingFlowCategories.js";

function normalizeText(value) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Fallback por nome (EN/PT) se `icon_key` não bater. */
const ONBOARDING_FLOW_NAME_KEYS = {
  negocios: ["business", "negocios", "negócios", "work"],
};

function collectOrderedFlowIds(categoryIds) {
  const ordered = [];
  const seen = new Set();
  for (const flowId of categoryIds ?? []) {
    if (!flowId || seen.has(flowId)) continue;
    seen.add(flowId);
    ordered.push(flowId);
  }
  return ordered;
}

function findExistingTagForFlow(tags, flowId) {
  const iconKey = ONBOARDING_FLOW_TO_ICON_KEY[flowId];
  if (iconKey) {
    const byIcon = tags.find((t) => t.icon_key === iconKey);
    if (byIcon) return byIcon;
  }
  const nameKeys = ONBOARDING_FLOW_NAME_KEYS[flowId];
  if (nameKeys?.length) {
    for (const t of tags) {
      const n = normalizeText(t.name);
      if (nameKeys.some((k) => n === normalizeText(k))) return t;
    }
  }
  return null;
}

async function persistOnboardingCategories(organizationId, categoryIds) {
  const flowIds = collectOrderedFlowIds(categoryIds);
  if (!flowIds.length) return;

  const existingTagsResponse = await listTags(organizationId, "categoria");
  const tags = existingTagsResponse?.tags ?? [];

  let index = 0;
  for (const flowId of flowIds) {
    const existing = findExistingTagForFlow(tags, flowId);
    if (!existing?.id) continue;

    await updateTag(existing.id, {
      name: existing.name,
      tag_type_id: existing.tag_type.id,
      color: existing.color,
      icon_key: existing.icon_key ?? null,
      parent_category_tag_id: existing.parent_category_tag_id ?? null,
      sort_order: index,
      is_onboarding_highlight: true,
    });
    index += 1;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function collectInvitationEmails(data) {
  const raw = (data?.membros ?? [])
    .map((member) => member?.trim())
    .filter(Boolean);
  const unique = [...new Set(raw.map((e) => e.toLowerCase()))];
  return unique.filter((e) => EMAIL_RE.test(e));
}

function buildRecurringStartDate() {
  return formatLocalIsoDate(new Date());
}

function buildOnboardingRecurringPayload(data) {
  const value = parseMoneyInput(data?.recVal);
  if (data?.temRec !== "sim" || value == null || value <= 0) return null;

  return {
    type: "income",
    description: data?.recDesc?.trim() || "Receita mensal",
    value,
    payment_method: "pix",
    frequency: "monthly",
    start_date: buildRecurringStartDate(),
    day_of_month: Number.parseInt(data?.recDia, 10) || 5,
    value_kind: "exact",
    category: "Receita",
  };
}

/**
 * Últimos 4 dígitos informados no passo de cartão, normalizados.
 *
 * O backend exige EXATAMENTE 4 dígitos (`CreateCreditCardRequest.last4`,
 * `min_length=4`). Enquanto este builder mandava `""` fixo, todo onboarding
 * com cartão morria em 422 e derrubava o fluxo inteiro.
 */
function onboardingCardLast4(data) {
  return String(data?.card4 ?? "").replace(/\D/g, "").slice(-4);
}

function buildOnboardingCreditCardPayload(data, organizationId) {
  if (data?.temCartao !== "sim" || !data?.cardNome?.trim()) return null;

  const last4 = onboardingCardLast4(data);
  // Sem os 4 dígitos não dá para criar o cartão. Preferimos não criar (o
  // usuário cadastra depois em Cartões) a inventar "0000" no banco dele.
  if (last4.length !== 4) return null;

  return buildCreateCreditCardPayload({
    organizationId,
    brand: data.cardNome.trim(),
    displayName: data.cardNome.trim(),
    last4Digits: last4,
    limitInput: data.cardLim || "",
    dueDay: data.cardVenc || "",
    closingDay: "",
  });
}

/**
 * Organização a usar nesta submissão.
 *
 * O onboarding é uma sequência de chamadas independentes (org → receita →
 * cartão → categorias → convites → perfil) e não existe transação que
 * abranja todas. Quando um passo do meio falhava, o usuário clicava de novo
 * e a org anterior virava lixo: um usuário chegou a acumular 4 orgs
 * idênticas em produção. Enquanto `onboarding_completed` é falso, qualquer
 * org da qual ele já é owner só pode ter vindo de uma tentativa anterior —
 * então reusamos a mais recente em vez de criar outra.
 */
async function resolveOnboardingOrganization(createPayload) {
  let existing = null;
  try {
    const response = await getMyOrganizations();
    const owned = (response?.organizations ?? [])
      .filter((entry) => entry?.membership?.role === "owner" && entry?.organization?.id);
    if (owned.length) {
      existing = owned
        .slice()
        .sort((a, b) =>
          String(a.organization.created_at ?? "").localeCompare(
            String(b.organization.created_at ?? ""),
          ),
        )
        .at(-1).organization;
    }
  } catch {
    // Não conseguir listar não pode impedir o onboarding — segue criando.
    existing = null;
  }

  if (!existing) {
    const created = await createOrganization(createPayload);
    return { organization: created.organization, reused: false };
  }

  // Reaproveita, mas com as respostas desta tentativa (ele pode ter mudado
  // o nome ou o tipo antes de tentar de novo).
  const patch = {
    name: createPayload.name,
    description: createPayload.description,
  };
  if (createPayload.org_type) patch.org_type = createPayload.org_type;
  if (createPayload.monthly_income != null) {
    patch.monthly_income = createPayload.monthly_income;
  }
  try {
    const updated = await updateOrganization(existing.id, patch);
    return { organization: updated?.id ? updated : { ...existing, ...patch }, reused: true };
  } catch {
    return { organization: existing, reused: true };
  }
}

/** Já existe uma receita recorrente equivalente? Evita duplicar em retry. */
async function hasEquivalentRecurringSeries(organizationId, payload) {
  try {
    const response = await listRecurringSeries(organizationId);
    return (response?.series ?? []).some(
      (serie) =>
        serie?.type === payload.type &&
        String(serie?.description ?? "").trim().toLowerCase() ===
          payload.description.trim().toLowerCase(),
    );
  } catch {
    return false;
  }
}

export async function submitOnboarding(data) {
  const orgName = data?.orgNome?.trim();

  if (!orgName) {
    throw new Error("Informe o nome da organizacao para concluir o onboarding.");
  }

  const monthlyIncome =
    data.temRec === "sim" ? parseMoneyInput(data.recVal) : null;

  const createPayload = {
    name: orgName,
    description: buildOrganizationDescription(data.orgTipo),
  };
  if (data.orgTipo) {
    createPayload.org_type = data.orgTipo;
  }
  if (monthlyIncome != null) {
    createPayload.monthly_income = monthlyIncome;
  }

  let organization;
  let reused;
  try {
    ({ organization, reused } = await resolveOnboardingOrganization(createPayload));
  } catch (error) {
    // A organização é o único passo obrigatório: sem ela não há onboarding.
    throw new Error(formatOnboardingApiError(error));
  }

  if (!organization?.id) {
    // Resposta fora do contrato: parar aqui é melhor do que seguir gravando
    // receita e cartão em `undefined`.
    throw new Error("Nao foi possivel criar sua organizacao. Tente novamente.");
  }

  // Daqui em diante nada pode derrubar o onboarding. Cada etapa é opcional e
  // refazível dentro do app; falhar uma delas não pode prender o usuário na
  // tela de configuração nem deixar organização órfã para trás.
  const warnings = [];
  const runOptionalStep = async (warning, step) => {
    try {
      await step();
    } catch {
      warnings.push(warning);
    }
  };

  const recurringPayload = buildOnboardingRecurringPayload(data);
  if (recurringPayload) {
    await runOptionalStep("Não foi possível salvar a receita recorrente.", async () => {
      if (reused && (await hasEquivalentRecurringSeries(organization.id, recurringPayload))) {
        return;
      }
      await createRecurringSeries(organization.id, recurringPayload);
    });
  }

  const creditCardPayload = buildOnboardingCreditCardPayload(data, organization.id);
  if (creditCardPayload) {
    await runOptionalStep("Não foi possível salvar o cartão.", () =>
      createCreditCard(creditCardPayload),
    );
  }

  await runOptionalStep("Não foi possível destacar as categorias escolhidas.", () =>
    persistOnboardingCategories(organization.id, data?.cats),
  );

  const inviteEmails = collectInvitationEmails(data);
  if (inviteEmails.length) {
    await runOptionalStep("Não foi possível enviar os convites.", () =>
      createOrganizationInvitations(organization.id, inviteEmails),
    );
  }

  try {
    await updateMyProfile({ onboarding_completed: true });
  } catch (error) {
    // Sem esta marca o app devolve o usuário ao onboarding no próximo login,
    // e aí sim vale interromper para ele tentar de novo (agora sem duplicar
    // organização, porque a próxima tentativa reusa a que acabou de criar).
    throw new Error(formatOnboardingApiError(error));
  }

  const organizationsResponse = await getMyOrganizations().catch(() => ({
    organizations: [],
    total: 0,
  }));

  return {
    organization,
    activeOrgId: organization.id,
    organizations: organizationsResponse.organizations ?? [],
    warnings,
  };
}
