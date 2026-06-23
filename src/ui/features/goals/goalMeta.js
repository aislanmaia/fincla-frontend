// Taxonomia de tipos, prazos e prioridade dos Projetos de Vida (M1).
// `type` é taxonomia do frontend (backend aceita string livre). Labels em PT; ids em inglês.
// Cores referenciam os tokens do design system (T) — fonte única.

import { T } from "../../tokens";

export const GOAL_TYPES = [
  { id: "emergency_fund", label: "Reserva", emoji: "🛡️", tint: T.greenLight, color: T.green, bar: T.greenBar },
  { id: "travel", label: "Viagem", emoji: "✈️", tint: T.blueLight, color: T.blue, bar: T.blueBar },
  { id: "home", label: "Casa", emoji: "🏠", tint: T.amberLight, color: T.amber, bar: T.amberBar },
  { id: "education", label: "Educação", emoji: "🎓", tint: T.purpleLight, color: T.purple, bar: T.purpleBar },
  { id: "purchase", label: "Compra", emoji: "🛍️", tint: T.blueLight, color: T.blue, bar: T.blueBar },
  { id: "debt_payoff", label: "Quitar dívida", emoji: "💳", tint: T.redLight, color: T.red, bar: T.redBar },
  { id: "investment", label: "Investimento", emoji: "📈", tint: T.greenLight, color: T.green, bar: T.greenBar },
  { id: "retirement", label: "Aposentadoria", emoji: "🌅", tint: T.purpleLight, color: T.purple, bar: T.purpleBar },
  { id: "other", label: "Outro", emoji: "🎯", tint: T.grayLight, color: T.inkMid, bar: T.inkGhost },
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
  { id: "short", label: "Curto prazo", short: "Curto", color: T.red, hint: "Até ~1 ano", examples: "Reserva, conserto, presente…" },
  { id: "medium", label: "Médio prazo", short: "Médio", color: T.amber, hint: "1 a 3 anos", examples: "Viagem, troca de carro, curso…" },
  { id: "long", label: "Longo prazo", short: "Longo", color: T.purple, hint: "Mais de 3 anos", examples: "Casa, aposentadoria, faculdade…" },
];
export const TERM_NONE = { id: "none", label: "Sem prazo", short: "Sem prazo", color: T.inkGhost };
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
  { id: "alta", label: "Urgente", n: 3, color: T.red, tint: T.redLight },
  { id: "media", label: "Média", n: 2, color: T.amber, tint: T.amberLight },
  { id: "baixa", label: "Baixa", n: 1, color: T.inkMid, tint: T.grayLight },
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
