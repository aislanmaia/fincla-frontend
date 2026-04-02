/**
 * Categorias seed na API em inglês + `icon_key` estável.
 * UI em PT: prioridade icon_key → nome EN exato → fallback `name` da tag.
 */

import { normalizeCategoryIconKey } from "./categoryLucideIcons.js";

/**
 * Unifica campos da tag (ou fragmento) vindos da API.
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {{ name: string | null; icon_key: string | null }}
 */
export function coerceCategoryTagShape(raw) {
  if (!raw || typeof raw !== "object") return { name: null, icon_key: null };
  const o = raw;
  const name =
    (typeof o.name === "string" && o.name.trim()) ||
    (typeof o.tag_name === "string" && o.tag_name.trim()) ||
    (typeof o.label === "string" && o.label.trim()) ||
    null;
  const icon_key =
    (typeof o.icon_key === "string" && o.icon_key.trim()) ||
    (typeof o.iconKey === "string" && o.iconKey.trim()) ||
    (typeof o.tag_icon_key === "string" && o.tag_icon_key.trim()) ||
    null;
  return { name, icon_key };
}

export const CATEGORY_LABEL_PT_BY_ICON_KEY = {
  "shopping-cart": "Alimentação",
  car: "Transporte",
  pill: "Saúde",
  "book-open": "Educação",
  "party-popper": "Lazer & Entretenimento",
  "shopping-bag": "Compras Pessoais",
  wrench: "Serviços",
  smartphone: "Assinaturas & Software",
  receipt: "Impostos & Taxas",
  home: "Moradia",
  wallet: "Receita",
};

/** Nomes canônicos em inglês retornados pelo seed (variações comuns). */
export const CATEGORY_LABEL_PT_BY_EN_NAME = {
  "Food & Groceries": "Alimentação",
  Transport: "Transporte",
  Health: "Saúde",
  Education: "Educação",
  "Leisure & Entertainment": "Lazer & Entretenimento",
  "Personal Shopping": "Compras Pessoais",
  Services: "Serviços",
  "Subscriptions & Software": "Assinaturas & Software",
  "Taxes & Fees": "Impostos & Taxas",
  Housing: "Moradia",
  Income: "Receita",
};

/** Variações de nome que alguns backends enviam fora do canônico do guia → rótulo PT. */
const CATEGORY_EN_NAME_ALIASES = {
  "food and groceries": "Alimentação",
  "leisure and entertainment": "Lazer & Entretenimento",
  "personal shopping": "Compras Pessoais",
  "subscriptions & software": "Assinaturas & Software",
  "subscriptions and software": "Assinaturas & Software",
  "taxes & fees": "Impostos & Taxas",
  "taxes and fees": "Impostos & Taxas",
};

/**
 * @param {string | null | undefined} name
 * @returns {string | null}
 */
function labelPtFromEnglishCategoryName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (CATEGORY_LABEL_PT_BY_EN_NAME[trimmed]) {
    return CATEGORY_LABEL_PT_BY_EN_NAME[trimmed];
  }
  const aliasPt = CATEGORY_EN_NAME_ALIASES[trimmed.toLowerCase()];
  if (aliasPt) return aliasPt;
  const lower = trimmed.toLowerCase();
  for (const [en, pt] of Object.entries(CATEGORY_LABEL_PT_BY_EN_NAME)) {
    if (en.toLowerCase() === lower) return pt;
  }
  return null;
}

/**
 * @param {{ name?: string | null; icon_key?: string | null } | Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function categoryLabelPtForTag(tag) {
  if (!tag) return "Categoria";
  const { name, icon_key: rawIk } = coerceCategoryTagShape(
    /** @type {Record<string, unknown>} */ (tag),
  );
  const ikNorm = normalizeCategoryIconKey(rawIk);
  if (ikNorm && CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm]) {
    return CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm];
  }
  const fromEn = labelPtFromEnglishCategoryName(name);
  if (fromEn) return fromEn;
  return name || "Categoria";
}

/**
 * Rótulos PT só do protótipo/mock (atalhos) → mesmo `icon_key` do seed quando faz sentido.
 * @type {Record<string, string | null>}
 */
const LABEL_PT_ICON_KEY_ALIASES = {
  Lazer: "party-popper",
  Assinaturas: "smartphone",
  Vestuário: "shopping-bag",
  Outros: null,
  Renda: "wallet",
};

/**
 * Ícone Lucide para a linha da UI: prioriza `icon_key` da API; no mock, deriva do rótulo PT.
 * @param {string | null | undefined} iconKeyFromApi
 * @param {string | null | undefined} labelPt
 * @returns {string | null}
 */
export function resolveCategoryIconKey(iconKeyFromApi, labelPt) {
  const normalized = normalizeCategoryIconKey(iconKeyFromApi);
  if (normalized) return normalized;
  if (!labelPt) return null;
  if (Object.prototype.hasOwnProperty.call(LABEL_PT_ICON_KEY_ALIASES, labelPt)) {
    return LABEL_PT_ICON_KEY_ALIASES[labelPt];
  }
  for (const [ik, pt] of Object.entries(CATEGORY_LABEL_PT_BY_ICON_KEY)) {
    if (pt === labelPt) return ik;
  }
  return null;
}
