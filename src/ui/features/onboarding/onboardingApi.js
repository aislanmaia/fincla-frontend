import {
  createCreditCard,
  createOrganization,
  createOrganizationInvitations,
  createRecurringSeries,
  formatOnboardingApiError,
  getMyOrganizations,
  listTags,
  updateMyProfile,
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

function buildOnboardingCreditCardPayload(data, organizationId) {
  if (data?.temCartao !== "sim" || !data?.cardNome?.trim()) return null;

  return buildCreateCreditCardPayload({
    organizationId,
    brand: data.cardNome.trim(),
    nome: data.cardNome.trim(),
    digitos: "",
    limite: data.cardLim || "",
    vencimento: data.cardVenc || "",
    fechamento: "",
  });
}

export async function submitOnboarding(data) {
  const orgName = data?.orgNome?.trim();

  if (!orgName) {
    throw new Error("Informe o nome da organizacao para concluir o onboarding.");
  }

  try {
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

    const created = await createOrganization(createPayload);

    const operations = [];

    const recurringPayload = buildOnboardingRecurringPayload(data);
    if (recurringPayload) {
      operations.push(
        createRecurringSeries(created.organization.id, recurringPayload),
      );
    }

    const creditCardPayload = buildOnboardingCreditCardPayload(
      data,
      created.organization.id,
    );
    if (creditCardPayload) {
      operations.push(createCreditCard(creditCardPayload));
    }

    await Promise.all(operations);
    await persistOnboardingCategories(created.organization.id, data?.cats);

    const inviteEmails = collectInvitationEmails(data);
    if (inviteEmails.length) {
      await createOrganizationInvitations(created.organization.id, inviteEmails);
    }

    await updateMyProfile({ onboarding_completed: true });

    const organizationsResponse = await getMyOrganizations().catch(() => ({
      organizations: [],
      total: 0,
    }));

    return {
      organization: created.organization,
      activeOrgId: created.organization.id,
      organizations: organizationsResponse.organizations ?? [],
    };
  } catch (error) {
    throw new Error(formatOnboardingApiError(error));
  }
}
