import {
  createGoal,
  listGoals,
  updateGoal,
} from "../../api/goals";
import { handleApiError } from "../../api/client";
import { effectiveTerm, priorityFromNumber, priorityToNumber } from "../features/goals/goalMeta.js";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseAmount(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(normalized) || 0;
}

/** "10,5" (percentual) -> 0.105 (taxa). Vazio -> null. */
function parsePercentToRate(value) {
  if (value === "" || value == null) return null;
  const pct = parseAmount(value);
  return pct ? pct / 100 : 0;
}

/** taxa 0.105 -> "10,5" (para popular o input ao editar). */
export function rateToPercentInput(rate) {
  if (rate == null) return "";
  return String(Number((Number(rate) * 100).toFixed(4))).replace(".", ",");
}

function formatDeadline(value) {
  if (!value) return "Sem prazo";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sem prazo";
  return `${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

/** <input type="month"> "2027-12" -> "2027-12-01" (ISO date). Vazio -> null. */
export function monthInputToDeadline(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

/** "2027-12-01" -> "2027-12" (para o input type=month ao editar). */
export function deadlineToMonthInput(value) {
  if (!value) return "";
  const v = String(value).trim();
  return /^\d{4}-\d{2}/.test(v) ? v.slice(0, 7) : "";
}

export function mapGoalToUi(goal) {
  return {
    id: goal.id,
    nome: goal.name,
    desc: goal.description || "",
    status: goal.status,
    type: goal.type || "other",
    meta: Number(goal.target_amount) || 0,
    atual: Number(goal.current_amount) || 0,
    progress: Number(goal.progress) || 0,
    monthly_target: goal.monthly_target == null ? null : Number(goal.monthly_target),
    annual_return_rate: goal.annual_return_rate == null ? null : Number(goal.annual_return_rate),
    deadline: goal.deadline || null,
    prazo: formatDeadline(goal.deadline),
    term: effectiveTerm(goal),
    termExplicit: goal.term || null,
    prioridade: priorityFromNumber(goal.priority),
  };
}

/** Monta o payload de criação a partir do form (campos reais; sem current_amount). */
export function buildCreateGoalPayload(form) {
  return {
    name: form.nome,
    description: form.desc || null,
    target_amount: parseAmount(form.meta),
    deadline: monthInputToDeadline(form.deadline),
    type: form.type || null,
    term: form.term || null,
    priority: priorityToNumber(form.prioridade),
    monthly_target: form.monthly_target ? parseAmount(form.monthly_target) : null,
    annual_return_rate: parsePercentToRate(form.annual_return_rate),
  };
}

/** current_amount NÃO é editável (deriva dos goal_contributions). */
export function buildUpdateGoalPayload(form) {
  return {
    name: form.nome,
    description: form.desc || null,
    target_amount: parseAmount(form.meta),
    deadline: monthInputToDeadline(form.deadline),
    status: form.status || "active",
    type: form.type || null,
    term: form.term || null,
    priority: priorityToNumber(form.prioridade),
    monthly_target: form.monthly_target ? parseAmount(form.monthly_target) : null,
    annual_return_rate: parsePercentToRate(form.annual_return_rate),
  };
}

export async function listGoalsForUi(organizationId) {
  return listGoals(organizationId);
}

export async function createGoalForUi(payload) {
  return createGoal(payload);
}

export async function updateGoalForUi(goalId, organizationId, payload) {
  return updateGoal(goalId, organizationId, payload);
}

export function formatGoalsApiError(error) {
  return handleApiError(error);
}
