/**
 * Separadores de Configurações: slugs em inglês na URL (`/profile/account`, …).
 * IDs internos da página permanecem em PT (estado legado / RENDERERS).
 */

export const PROFILE_SETTINGS_TAB_SLUGS = [
  "account",
  "security",
  "organization",
  "members",
  "categories",
  "whatsapp",
  "billing",
];

/** @type {Record<string, string>} slug URL → id interno ConfiguracoesPage */
export const PROFILE_TAB_SLUG_TO_INTERNAL = {
  account: "perfil",
  security: "seguranca",
  organization: "organizacao",
  members: "membros",
  categories: "categorias",
  whatsapp: "whatsapp",
  billing: "assinatura",
};

/** @type {Record<string, string>} id interno → slug URL */
export const PROFILE_TAB_INTERNAL_TO_SLUG = Object.fromEntries(
  Object.entries(PROFILE_TAB_SLUG_TO_INTERNAL).map(([slug, internal]) => [
    internal,
    slug,
  ]),
);

export function isProfileSettingsTabSlug(tab) {
  return typeof tab === "string" && PROFILE_SETTINGS_TAB_SLUGS.includes(tab);
}

/** Primeiro segmento após `/profile/` (sem barra final). Vazio → null. */
export function profileSettingsTabSlugFromPathname(pathname) {
  const raw = String(pathname ?? "").replace(/^\//, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] !== "profile") return null;
  return parts[1] ?? null;
}
