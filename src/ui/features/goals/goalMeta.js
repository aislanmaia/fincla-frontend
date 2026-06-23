// Taxonomia de tipos, prazos e prioridade dos Projetos de Vida (M1).
// `type` é taxonomia do frontend (backend aceita string livre). Labels em PT; ids em inglês.

export const GOAL_TYPES = [
  { id: "emergency_fund", label: "Reserva", emoji: "🛡️", tint: "#ECFDF5", color: "#059669", bar: "#34D399" },
  { id: "travel", label: "Viagem", emoji: "✈️", tint: "#EFF6FF", color: "#2563EB", bar: "#60A5FA" },
  { id: "home", label: "Casa", emoji: "🏠", tint: "#FFFBEB", color: "#D97706", bar: "#FBBF24" },
  { id: "education", label: "Educação", emoji: "🎓", tint: "#F5F3FF", color: "#7C3AED", bar: "#A78BFA" },
  { id: "purchase", label: "Compra", emoji: "🛍️", tint: "#EFF6FF", color: "#2563EB", bar: "#60A5FA" },
  { id: "debt_payoff", label: "Quitar dívida", emoji: "💳", tint: "#FEF2F2", color: "#DC2626", bar: "#F87171" },
  { id: "investment", label: "Investimento", emoji: "📈", tint: "#ECFDF5", color: "#059669", bar: "#34D399" },
  { id: "retirement", label: "Aposentadoria", emoji: "🌅", tint: "#F5F3FF", color: "#7C3AED", bar: "#A78BFA" },
  { id: "other", label: "Outro", emoji: "🎯", tint: "#F3F4F6", color: "#374151", bar: "#9CA3AF" },
];
const TYPE_BY_ID = Object.fromEntries(GOAL_TYPES.map((t) => [t.id, t]));
export function goalTypeMeta(id) {
  return TYPE_BY_ID[id] || TYPE_BY_ID.other;
}
/** Tipos que fazem sentido ter rendimento esperado (mostra annual_return_rate). */
export function typeSupportsReturn(id) {
  return id === "investment" || id === "retirement";
}

export const TERMS = [
  { id: "short", label: "Curto prazo", short: "Curto", color: "#DC2626", hint: "Até ~1 ano", examples: "Reserva, conserto, presente…" },
  { id: "medium", label: "Médio prazo", short: "Médio", color: "#D97706", hint: "1 a 3 anos", examples: "Viagem, troca de carro, curso…" },
  { id: "long", label: "Longo prazo", short: "Longo", color: "#7C3AED", hint: "Mais de 3 anos", examples: "Casa, aposentadoria, faculdade…" },
];
export const TERM_NONE = { id: "none", label: "Sem prazo", short: "Sem prazo", color: "#9CA3AF" };
const TERM_BY_ID = Object.fromEntries([...TERMS, TERM_NONE].map((t) => [t.id, t]));
export function termMeta(id) {
  return TERM_BY_ID[id] || TERM_NONE;
}

/** Deriva o prazo a partir do deadline (ISO date) — usado quando o backend não traz `term`. */
export function deriveTerm(deadline) {
  if (!deadline) return null;
  const d = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (months <= 12) return "short";
  if (months <= 36) return "medium";
  return "long";
}

/** Prazo efetivo: explícito do backend > derivado do deadline > "none". */
export function effectiveTerm(goal) {
  return goal?.term || deriveTerm(goal?.deadline) || "none";
}

// Prioridade: número no backend (>=0). UI usa 3 níveis.
export const PRIORITIES = [
  { id: "alta", label: "Urgente", n: 3, color: "#DC2626", tint: "#FEF2F2" },
  { id: "media", label: "Média", n: 2, color: "#D97706", tint: "#FFFBEB" },
  { id: "baixa", label: "Baixa", n: 1, color: "#374151", tint: "#F3F4F6" },
];
const PRIO_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));
export function priorityMeta(id) {
  return PRIO_BY_ID[id] || PRIO_BY_ID.media;
}
export function priorityToNumber(id) {
  return priorityMeta(id).n;
}
export function priorityFromNumber(n) {
  if (n == null) return "media";
  if (n >= 3) return "alta";
  if (n <= 1) return "baixa";
  return "media";
}
