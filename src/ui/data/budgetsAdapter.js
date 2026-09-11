import {
  createBudget,
  listBudgets,
  updateBudget,
} from "../../api/budgets";
import { getMonthlyEvolution } from "../../api/analytics";
import { handleApiError } from "../../api/client";
import { toAmount } from "../../api/money";
import {
  categoryLabelPtForTag,
  resolveCategoryColorForTag,
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

/**
 * O resumo do topo, somando DENTRO de cada moeda.
 *
 * `reduce` sobre `amount` de todos os orçamentos empilhava € 800 com R$ 500 e
 * publicava 1.300 — um número de moeda nenhuma, e o defeito que o épico
 * multi-moeda existe para matar. Agora:
 *
 *   uma moeda  -> o total nela, como sempre (100% das organizações de hoje)
 *   várias     -> `null` no cabeçalho, e `porMoeda` com a quebra
 *
 * Converter aqui é proibido: o orçamento RESTRINGE em vez de converter
 * (fincla-api#141), senão um limite "estouraria" por variação de câmbio.
 */
function somarPorMoeda(budgets, campo) {
  const porMoeda = new Map();
  for (const b of budgets) {
    const moeda = b.currency || null;
    porMoeda.set(moeda, (porMoeda.get(moeda) ?? 0) + toNum(b[campo]));
  }
  return [...porMoeda.entries()]
    .map(([moeda, valor]) => ({ moeda, valor }))
    .sort((a, b) => String(a.moeda).localeCompare(String(b.moeda)));
}

function summarizeFromBudgetRows(budgets) {
  const moedas = new Set(budgets.map((b) => b.currency || null));
  const umaMoedaSo = moedas.size <= 1;
  const soma = (campo) =>
    umaMoedaSo ? budgets.reduce((s, b) => s + toNum(b[campo]), 0) : null;

  const total_budgeted = soma("amount");
  const total_spent = soma("spent_amount");
  const total_remaining = soma("remaining_amount");
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
    moeda: umaMoedaSo ? ([...moedas][0] ?? null) : null,
    porMoeda: umaMoedaSo ? [] : somarPorMoeda(budgets, "amount"),
    gastoPorMoeda: umaMoedaSo ? [] : somarPorMoeda(budgets, "spent_amount"),
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
    // A moeda DO ORÇAMENTO. Ele tem a sua, e o consumo é medido nela — um
    // orçamento em euro com gasto em real não é um orçamento estourado, é outra
    // conversa (fincla-api#141).
    moeda: budget.currency ?? null,
    /**
     * O gasto da MESMA categoria em OUTRA moeda, que o orçamento não mede.
     *
     * Vem como lista de `{amount, currency}` — uma entrada por moeda. Ele não
     * entra em `gasto` nem no percentual: somar ali seria inventar uma conversão
     * que ninguém pediu. Mas também não pode SUMIR da tela: um gasto que a pessoa
     * fez e não vê em lugar nenhum é pior que um número errado, porque ela nem
     * sabe que existe para procurar.
     */
    foraDoOrcamento: Array.isArray(budget.spent_outside_budget_currency)
      ? budget.spent_outside_budget_currency
          .map((m) => ({ valor: toNum(m?.amount ?? m), moeda: m?.currency ?? null }))
          .filter((m) => m.valor > 0 && m.moeda)
      : [],
    membros: meta.membros,
    envelopes: [],
    navFilter: budget.tag_id,
    color: resolveCategoryColorForTag(budget),
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
  // O percentual só existe quando há UMA moeda: 300 euros sobre 800 reais não é
  // uma fração de coisa nenhuma.
  const totalPct = summary.total_budgeted > 0 && summary.total_spent != null
    ? Math.round((summary.total_spent / summary.total_budgeted) * 100)
    : null;

  return {
    budget: summary.total_budgeted,
    totalGasto: summary.total_spent,
    totalDisp: summary.total_remaining,
    moeda: summary.moeda ?? null,
    porMoeda: summary.porMoeda ?? [],
    gastoPorMoeda: summary.gastoPorMoeda ?? [],
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
        color: row.color || resolveCategoryColorForTag(row),
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
  // `total_expenses` chega como Decimal serializado (string) do backend — converte
  // na fronteira com `toAmount` para que `spent` seja sempre número finito a partir
  // daqui (evita concatenação de string em somas/comparações no consumidor).
  return (months ?? []).map((item, index, all) => ({
    m: formatShortMonth(item.year, item.month),
    spent: toAmount(item.total_expenses),
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

export async function updateBudgetForUi(organizationId, budgetId, data) {
  return updateBudget(budgetId, organizationId, data);
}

export function formatBudgetsApiError(error) {
  return handleApiError(error);
}
