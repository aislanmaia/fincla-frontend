/**
 * Helpers para derivar nome de exibição, iniciais e badge de plano do
 * objeto `session.user`. Usado pela Sidebar e Topbar para evitar
 * hardcode de "Aislan"/"AS" — toda string visível ligada ao usuário
 * passa por aqui.
 */

import { T } from "../../tokens.js";

export function getDisplayName(user) {
  if (!user) return "—";
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  if (user.email) return user.email.split("@")[0];
  return "—";
}

export function getInitials(user) {
  if (!user) return "?";
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (initials) return initials;
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return "?";
}

export const PLAN_BADGE_STYLE = {
  essential: { label: "Essential", color: T.blue, bg: T.blueLight },
  pro: { label: "Pro", color: T.purple, bg: T.purpleLight },
  beta: { label: "Beta", color: T.ink, bg: T.bg },
};

export function getPlanBadge(user) {
  const slug = user?.subscription?.plan;
  if (!slug) return null;
  return PLAN_BADGE_STYLE[slug] ?? { label: slug, color: T.ink, bg: T.bg };
}
