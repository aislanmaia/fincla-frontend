import {
  BookOpen,
  Car,
  Home,
  PartyPopper,
  Pill,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Wallet,
  Wrench,
} from "lucide-react";

const BY_KEY = {
  "shopping-cart": ShoppingCart,
  car: Car,
  pill: Pill,
  "book-open": BookOpen,
  "party-popper": PartyPopper,
  "shopping-bag": ShoppingBag,
  wrench: Wrench,
  smartphone: Smartphone,
  receipt: Receipt,
  home: Home,
  wallet: Wallet,
};

const KNOWN_ICON_KEYS = new Set(Object.keys(BY_KEY));

/**
 * Converte `icon_key` da API (kebab, snake, PascalCase) para chave canônica do mapa Lucide.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function normalizeCategoryIconKey(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (KNOWN_ICON_KEYS.has(s)) return s;
  const lower = s.toLowerCase();
  if (KNOWN_ICON_KEYS.has(lower)) return lower;
  const fromSnake = lower.replace(/_/g, "-");
  if (KNOWN_ICON_KEYS.has(fromSnake)) return fromSnake;
  const kebab = s
    .replace(/_/g, "-")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  if (KNOWN_ICON_KEYS.has(kebab)) return kebab;
  return null;
}

/**
 * @param {string | null | undefined} iconKey Lucide kebab-case (ex.: shopping-cart)
 * @returns {import("react").ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null}
 */
export function getCategoryLucideIcon(iconKey) {
  const k = normalizeCategoryIconKey(iconKey);
  if (!k) return null;
  return BY_KEY[k] ?? null;
}
