import * as Lucide from "lucide-react";

function toPascalCase(iconKey) {
  return iconKey.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

function toKebabCase(name) {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/** Lucide is the supported icon library; the catalog stores kebab-case keys. */
const ICONS_BY_KEY = Object.fromEntries(
  Object.entries(Lucide)
    .filter(([name, icon]) => /^[A-Z][A-Za-z0-9]+$/.test(name) && !name.endsWith("Icon") && icon?.$$typeof)
    .map(([name, icon]) => [toKebabCase(name), icon]),
);
export const CATEGORY_ICON_KEYS = Object.keys(ICONS_BY_KEY).sort();

/**
 * Converte `icon_key` da API (kebab, snake, PascalCase) para chave canônica do mapa Lucide.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function normalizeCategoryIconKey(raw) {
  if (raw == null || raw === "") return null;
  const kebab = String(raw).trim()
    .replace(/_/g, "-")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return ICONS_BY_KEY[kebab] ? kebab : null;
}

/**
 * @param {string | null | undefined} iconKey Lucide kebab-case (ex.: shopping-cart)
 * @returns {import("react").ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null}
 */
export function getCategoryLucideIcon(iconKey) {
  const k = normalizeCategoryIconKey(iconKey);
  if (!k) return null;
  return k ? ICONS_BY_KEY[k] ?? null : null;
}
