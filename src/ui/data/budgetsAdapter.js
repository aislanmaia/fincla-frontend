import {
  createBudget,
  listBudgets,
} from "../../api/budgets";
import { getMonthlyEvolution } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import {
  categoryLabelPtForTag,
  resolveCategoryIconKey,
} from "./categoryLabels.js";
import { normalizeCategoryIconKey } from "./categoryLucideIcons.js";
import { listCategoryTagsForUi, mapCategoryTagsForUi } from "./tagsAdapter.js";

const CATEGORY_META = {
  alimentacao: { emoji: "🛒", membros: ["A", "M"], suggestedLimit: 1200 },
  moradia: { emoji: "🏠", membros: ["A", "M"], suggestedLimit: 1500 },
  transporte: { emoji: "🚗", membros: ["A"], suggestedLimit: 600 },
  saude: { emoji: "💊", membros: ["A", "M"], suggestedLimit: 400 },
  lazer: { emoji: "🎮", membros: ["A", "M"], suggestedLimit: 500 },
  educacao: { emoji: "📚", membros: ["A"], suggestedLimit: 800 },
  vestuario: { emoji: "👕", membros: ["M"], suggestedLimit: 300 },
  outros: { emoji: "📦", membros: ["A", "M"], suggestedLimit: 200 },
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveCategoryMeta(name) {
  const normalized = normalizeName(name).replace(/-/g, "");
  const meta = CATEGORY_META[normalized];

  return {
    id: normalizeName(name).replace(/-/g, "_"),
    emoji: meta?.emoji || "🏷️",
    membros: meta?.membros || [],
    suggestedLimit: meta?.suggestedLimit || 0,
  };
}

function resolveHealthLabel(alertCount) {
  if (alertCount === 0) return "Saudável";
  if (alertCount <= 2) return "Atenção";
  return "Crítico";
}

function toNum(v) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function summarizeFromBudgetRows(budgets) {
  const total_budgeted = budgets.reduce((s, b) => s + toNum(b.amount), 0);
  const total_spent = budgets.reduce((s, b) => s + toNum(b.spent_amount), 0);
  const total_remaining = budgets.reduce((s, b) => s + toNum(b.remaining_amount), 0);
  let budgets_exceeded = 0;
  let budgets_warning = 0;
  let budgets_ok = 0;
  for (const b of budgets) {
    if (b.status === "exceeded") budgets_exceeded += 1;
    else if (b.status === "warning") budgets_warning += 1;
    else budgets_ok += 1;
  }
  return {
    total_budgeted,
    total_spent,
    total_remaining,
    budgets_exceeded,
    budgets_warning,
    budgets_ok,
  };
}

function normalizeSummary(s) {
  return {
    total_budgeted: toNum(s?.total_budgeted),
    total_spent: toNum(s?.total_spent),
    total_remaining: toNum(s?.total_remaining),
    budgets_exceeded: toNum(s?.budgets_exceeded),
    budgets_warning: toNum(s?.budgets_warning),
    budgets_ok: toNum(s?.budgets_ok),
  };
}

function formatShortMonth(year, month) {
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "short" });
  return `${label.charAt(0).toUpperCase()}${label.slice(1, 3)}`;
}

function isTopLevelCategoryTag(t) {
  if (!t?.id) return false;
  const pid = t.parent_category_tag_id;
  if (pid != null && pid !== "") return false;
  const tt = t.tag_type?.name;
  if (typeof tt === "string") {
    const n = tt.toLowerCase();
    if (n !== "categoria" && n !== "category") return false;
  }
  return true;
}

export function mapBudgetToUi(budget) {
  const nomePt = categoryLabelPtForTag(budget);
  const meta = resolveCategoryMeta(nomePt);
  const categoryIconKey =
    normalizeCategoryIconKey(budget.tag_icon_key ?? budget.tagIconKey) ??
    resolveCategoryIconKey(
      budget.tag_icon_key ?? budget.tagIconKey ?? null,
      nomePt,
    );

  return {
    id: budget.id,
    slug: meta.id,
    budgetId: budget.id,
    tagId: budget.tag_id,
    nome: nomePt,
    categoryIconKey,
    emoji: meta.emoji,
    limite: toNum(budget.amount),
    gasto: toNum(budget.spent_amount),
    membros: meta.membros,
    envelopes: [],
    navFilter: budget.tag_id,
    color: budget.tag_color || null,
  };
}

export function mapBudgetsResponseToUi(response) {
  const raw = response?.budgets ?? [];
  const monthlyActive = raw.filter(
    (b) =>
      b.is_active !== false &&
      String(b.period_type ?? "monthly").toLowerCase() === "monthly"
  );
  const summary =
    monthlyActive.length > 0
      ? summarizeFromBudgetRows(monthlyActive)
      : normalizeSummary(response?.summary);
  const alertCount = summary.budgets_exceeded + summary.budgets_warning;
  const totalPct = summary.total_budgeted > 0
    ? Math.round((summary.total_spent / summary.total_budgeted) * 100)
    : 0;

  return {
    budget: summary.total_budgeted,
    totalGasto: summary.total_spent,
    totalDisp: summary.total_remaining,
    totalPct,
    alertCount,
    healthLabel: resolveHealthLabel(alertCount),
    cats: monthlyActive.map(mapBudgetToUi),
  };
}

export function buildBudgetCreateChoices(tags, budgets) {
  const usedIds = new Set((budgets ?? []).map((budget) => budget.tag_id));
  const topLevel = (tags ?? []).filter(isTopLevelCategoryTag);

  return mapCategoryTagsForUi(topLevel)
    .filter((row) => row.id && !usedIds.has(row.id))
    .map((row) => {
      const nomePt = row.labelPt;
      const meta = resolveCategoryMeta(nomePt);
      const categoryIconKey =
        normalizeCategoryIconKey(row.iconKey) ??
        resolveCategoryIconKey(row.iconKey, nomePt);
      return {
        id: row.id,
        nome: nomePt,
        categoryIconKey,
        emoji: meta.emoji,
        color: row.color || null,
        suggestedLimit: meta.suggestedLimit,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function buildCreateBudgetPayload(tagId, amount) {
  return {
    tag_id: tagId,
    amount,
    period_type: "monthly",
  };
}

export function parseBudgetAmountInput(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(normalized) || 0;
}

export function mapBudgetHistoryToUi(months) {
  return (months ?? []).map((item, index, all) => ({
    m: formatShortMonth(item.year, item.month),
    spent: item.total_expenses,
    current: index === all.length - 1,
  }));
}

export async function listBudgetsForUi(organizationId) {
  return listBudgets(organizationId);
}

export async function listBudgetHistoryForUi(organizationId, months = 6) {
  return getMonthlyEvolution(organizationId, months);
}

export async function listBudgetCategoryChoicesForUi(organizationId) {
  const response = await listCategoryTagsForUi(organizationId);
  return response.tags ?? [];
}

export async function createBudgetForUi(organizationId, payload) {
  return createBudget(organizationId, payload);
}

export function formatBudgetsApiError(error) {
  return handleApiError(error);
}
