import {
  createGoal,
  listGoals,
  updateGoal,
} from "../../api/goals";
import { handleApiError } from "../../api/client";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const GOAL_STYLES = [
  { cor: "#059669", corLight: "#ECFDF5" },
  { cor: "#2563EB", corLight: "#EFF6FF" },
  { cor: "#7C3AED", corLight: "#F5F3FF" },
  { cor: "#D97706", corLight: "#FFFBEB" },
  { cor: "#DC2626", corLight: "#FEF2F2" },
  { cor: "#0891B2", corLight: "#ECFEFF" },
];

function parseAmount(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(normalized) || 0;
}

function formatDeadline(value) {
  if (!value) return "Sem prazo";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sem prazo";
  return `${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

function parseDeadlineInput(value) {
  if (!value) return null;
  const months = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  const [monthRaw, yearRaw] = String(value).trim().split(/\s+/);
  const month = months[monthRaw?.slice(0, 3).toLowerCase()];
  const year = Number(yearRaw);
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function resolveEmoji(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("reserva")) return "🛡️";
  if (normalized.includes("viagem")) return "✈️";
  if (normalized.includes("notebook") || normalized.includes("computador")) return "💻";
  if (normalized.includes("carro")) return "🚗";
  if (normalized.includes("casa") || normalized.includes("moradia")) return "🏠";
  if (normalized.includes("estudo") || normalized.includes("curso")) return "📚";
  return "🎯";
}

function resolvePriority(goal) {
  const normalized = String(goal.name || "").toLowerCase();
  if (normalized.includes("reserva")) return "alta";
  if (!goal.deadline) return "media";
  const deadline = new Date(`${goal.deadline}T00:00:00`);
  const today = new Date();
  const months = Math.max(0, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()));
  if (months <= 6) return "alta";
  if (months <= 18) return "media";
  return "baixa";
}

function resolveMonthlyContribution(goal) {
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  if (!goal.deadline) return Math.ceil(remaining / 12);
  const deadline = new Date(`${goal.deadline}T00:00:00`);
  const today = new Date();
  const months = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + (deadline.getMonth() - today.getMonth()) + 1);
  return Math.ceil(remaining / Math.max(months, 12));
}

export function mapGoalToUi(goal, index = 0) {
  const style = GOAL_STYLES[index % GOAL_STYLES.length];

  return {
    id: goal.id,
    nome: goal.name,
    emoji: resolveEmoji(goal.name),
    meta: Number(goal.target_amount) || 0,
    atual: Number(goal.current_amount) || 0,
    mensal: resolveMonthlyContribution(goal),
    prazo: formatDeadline(goal.deadline),
    cor: style.cor,
    corLight: style.corLight,
    prioridade: resolvePriority(goal),
    desc: goal.description || "",
    status: goal.status,
  };
}

export function buildCreateGoalPayload(form) {
  return {
    name: form.nome,
    description: form.desc || null,
    target_amount: parseAmount(form.meta),
    current_amount: parseAmount(form.atual),
    deadline: parseDeadlineInput(form.prazo),
  };
}

export function buildUpdateGoalPayload(form) {
  return {
    name: form.nome,
    description: form.desc || null,
    target_amount: parseAmount(form.meta),
    current_amount: parseAmount(form.atual),
    deadline: parseDeadlineInput(form.prazo),
    status: form.status || "active",
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
