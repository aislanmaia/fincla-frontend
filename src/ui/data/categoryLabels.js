/**
 * Categorias seed na API em inglês + `icon_key` estável.
 * UI em PT: nome é a chave primária (só traduz quando bate com um nome
 * canônico do seed); `icon_key` só entra como desempate quando não há nome
 * nenhum. Categoria renomeada pelo usuário deixa de bater no nome canônico e
 * mostra o nome como está — nunca mais "volta" pra tradução antiga.
 */

import { normalizeCategoryIconKey } from "./categoryLucideIcons.js";

function normalizeCategoryLookupKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Unifica campos da tag (ou fragmento) vindos da API.
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {{ name: string | null; icon_key: string | null; is_default: boolean | null }}
 */
export function coerceCategoryTagShape(raw) {
  if (!raw || typeof raw !== "object") return { name: null, icon_key: null, is_default: null };
  const o = raw;
  const name =
    (typeof o.name === "string" && o.name.trim()) ||
    (typeof o.tag_name === "string" && o.tag_name.trim()) ||
    (typeof o.category_name === "string" && o.category_name.trim()) ||
    (typeof o.tagName === "string" && o.tagName.trim()) ||
    (typeof o.apiName === "string" && o.apiName.trim()) ||
    (typeof o.labelPt === "string" && o.labelPt.trim()) ||
    (typeof o.label === "string" && o.label.trim()) ||
    null;
  const icon_key =
    (typeof o.icon_key === "string" && o.icon_key.trim()) ||
    (typeof o.iconKey === "string" && o.iconKey.trim()) ||
    (typeof o.tag_icon_key === "string" && o.tag_icon_key.trim()) ||
    (typeof o.tagIconKey === "string" && o.tagIconKey.trim()) ||
    (typeof o.categoryIconKey === "string" && o.categoryIconKey.trim()) ||
    null;
  const is_default =
    typeof o.is_default === "boolean"
      ? o.is_default
      : typeof o.isDefault === "boolean"
        ? o.isDefault
        : null;
  return { name, icon_key, is_default };
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

const CATEGORY_LABEL_PT_BY_EN_NAME_NORMALIZED = Object.fromEntries(
  Object.entries(CATEGORY_LABEL_PT_BY_EN_NAME).map(([en, pt]) => [
    normalizeCategoryLookupKey(en),
    pt,
  ]),
);

const CATEGORY_LABEL_PT_BY_PT_NAME = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  educacao: "Educação",
  "lazer entretenimento": "Lazer & Entretenimento",
  "lazer e entretenimento": "Lazer & Entretenimento",
  "compras pessoais": "Compras Pessoais",
  servicos: "Serviços",
  "assinaturas software": "Assinaturas & Software",
  "assinaturas e software": "Assinaturas & Software",
  "impostos taxas": "Impostos & Taxas",
  "impostos e taxas": "Impostos & Taxas",
  moradia: "Moradia",
  receita: "Receita",
  renda: "Receita",
  outros: "Outros",
  vestuario: "Vestuário",
  lazer: "Lazer",
  assinaturas: "Assinaturas",
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
  const normalized = normalizeCategoryLookupKey(trimmed);
  if (CATEGORY_LABEL_PT_BY_EN_NAME_NORMALIZED[normalized]) {
    return CATEGORY_LABEL_PT_BY_EN_NAME_NORMALIZED[normalized];
  }
  const aliasPt = CATEGORY_EN_NAME_ALIASES[trimmed.toLowerCase()];
  if (aliasPt) return aliasPt;
  return null;
}

/**
 * @param {string | null | undefined} name
 * @returns {string | null}
 */
function labelPtFromPortugueseCategoryName(name) {
  if (!name) return null;
  const normalized = normalizeCategoryLookupKey(name);
  return CATEGORY_LABEL_PT_BY_PT_NAME[normalized] ?? null;
}

/**
 * Nome é a chave primária: só traduz quando o nome cru bater com um nome
 * canônico do seed (EN ou PT). `icon_key` NUNCA sobrepõe um nome que já não
 * bate mais com o canônico — senão renomear uma categoria vira um no-op
 * silencioso na tela (a linha "Food & Groceries" → "Mercado do Zé" continuava
 * mostrando "Alimentação" porque o icon_key "shopping-cart" resolvia antes do
 * nome custom ser sequer olhado). `icon_key` só é consultado quando não há
 * nome nenhum — aí sim é um desempate de verdade, não uma chave alternativa.
 * @param {{ name?: string | null; icon_key?: string | null } | Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function categoryLabelPtForTag(tag) {
  if (!tag) return "Categoria";
  const { name, icon_key: rawIk } = coerceCategoryTagShape(
    /** @type {Record<string, unknown>} */ (tag),
  );
  if (!name) {
    const ikNorm = normalizeCategoryIconKey(rawIk);
    if (ikNorm && CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm]) {
      return CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm];
    }
    return "Categoria";
  }
  const fromEn = labelPtFromEnglishCategoryName(name);
  if (fromEn) return fromEn;
  const fromPt = labelPtFromPortugueseCategoryName(name);
  if (fromPt) return fromPt;
  return name;
}

const CATEGORY_COLOR_BY_LABEL_PT = {
  "Alimentação": "#059669",
  Transporte: "#2563EB",
  Saúde: "#DC2626",
  Educação: "#7C3AED",
  "Lazer & Entretenimento": "#D97706",
  Lazer: "#D97706",
  "Compras Pessoais": "#DC2626",
  Serviços: "#6B7280",
  "Assinaturas & Software": "#0891B2",
  Assinaturas: "#7C3AED",
  "Impostos & Taxas": "#D97706",
  Moradia: "#6B7280",
  Receita: "#059669",
  Renda: "#059669",
  Outros: "#374151",
  Vestuário: "#BE185D",
};

const CATEGORY_COLOR_PALETTE = [
  "#059669",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DC2626",
  "#0891B2",
  "#BE185D",
  "#0F766E",
  "#4F46E5",
  "#F97316",
];

function hashCategoryColorKey(value) {
  const key = normalizeCategoryLookupKey(value);
  if (!key) return 0;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Resolve uma cor estável para a tag de categoria.
 * Prioriza a cor explícita da API; caso falte, usa a cor canônica da UI e,
 * por fim, uma paleta fixa não-cinza baseada no nome/ícone da categoria.
 * @param {Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function resolveCategoryColorForTag(tag) {
  if (!tag || typeof tag !== "object") return "#6B7280";
  const o = tag;
  const explicitColor =
    (typeof o.tag_color === "string" && o.tag_color.trim()) ||
    (typeof o.color === "string" && o.color.trim()) ||
    (typeof o.category_color === "string" && o.category_color.trim()) ||
    null;
  if (explicitColor) return explicitColor;

  const { name, icon_key: rawIk } = coerceCategoryTagShape(o);
  const labelPt = categoryLabelPtForTag({ name, icon_key: rawIk });
  if (labelPt && CATEGORY_COLOR_BY_LABEL_PT[labelPt]) {
    return CATEGORY_COLOR_BY_LABEL_PT[labelPt];
  }

  const key = normalizeCategoryLookupKey(labelPt || name || rawIk);
  if (!key) return "#6B7280";
  return CATEGORY_COLOR_PALETTE[hashCategoryColorKey(key) % CATEGORY_COLOR_PALETTE.length];
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
 * Nomes canônicos em inglês das tags "detalhe" (subcategorias filhas, seed
 * `CANONICAL_CATEGORY_SEED` em fincla-api/src/infrastructure/database/seeds/
 * seed_default_tags.py) → rótulo PT. Toda organização nova recebe essas ~25 tags
 * automaticamente (`create_organization` chama `seed_default_tags`), então elas
 * aparecem em qualquer conta nova — não é só dado de demo/teste.
 */
export const DETAIL_LABEL_PT_BY_EN_NAME = {
  grocery: "mercado",
  restaurant: "restaurante",
  delivery: "delivery",
  fuel: "combustível",
  uber: "uber",
  bus: "ônibus",
  pharmacy: "farmácia",
  doctor: "médico",
  health_plan: "plano de saúde",
  course: "curso",
  book: "livro",
  cinema: "cinema",
  travel: "viagem",
  bar: "bar",
  clothing: "roupas",
  electronics: "eletrônicos",
  streaming: "streaming",
  app: "aplicativo",
  tax: "imposto",
  fee: "taxa",
  rent: "aluguel",
  energy: "energia",
  water: "água",
  salary: "salário",
  freelance: "freelance",
};

const DETAIL_LABEL_PT_BY_EN_NAME_NORMALIZED = Object.fromEntries(
  Object.entries(DETAIL_LABEL_PT_BY_EN_NAME).map(([en, pt]) => [
    normalizeCategoryLookupKey(en),
    pt,
  ]),
);

/** Nomes de tags "detalhe" já avisados no console (evita spam a cada render/tecla). */
const WARNED_UNMAPPED_DETAIL_NAMES = new Set();

/**
 * Rótulo PT para uma tag "detalhe" (subcategoria). Cobre o seed canônico acima
 * — mas só quando a tag É de fato a linha do seed: `is_default !== true`
 * (tag criada pelo usuário, sempre `is_default: false` no backend) passa
 * direto, sem tradução. Sem essa checagem, um usuário que cria sua própria
 * tag chamada "App" ou "Bar" tem o nome sequestrado pelo mapa (ela não é a
 * linha do seed, só coincide o texto) e não acha mais a própria tag.
 *
 * Fallback quando `is_default === true` mas o nome não está no mapa (ex.:
 * tags legadas da migração de categoria com nome PT que não é do
 * `CANONICAL_CATEGORY_SEED`): nunca devolve o slug cru — humaniza (`_` →
 * espaço) e registra no console (uma vez por nome) para completar o mapa.
 * @param {{ name?: string | null; is_default?: boolean | null } | Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function detailLabelPtForTag(tag) {
  const { name, is_default } = coerceCategoryTagShape(
    /** @type {Record<string, unknown>} */ (tag),
  );
  if (!name) return "";
  if (is_default !== true) return name;
  const normalized = normalizeCategoryLookupKey(name);
  const known = DETAIL_LABEL_PT_BY_EN_NAME_NORMALIZED[normalized];
  if (known) return known;
  if (!WARNED_UNMAPPED_DETAIL_NAMES.has(normalized)) {
    WARNED_UNMAPPED_DETAIL_NAMES.add(normalized);
    console.warn(
      `[categoryLabels] tag "detalhe" (is_default) sem tradução PT no mapa (mostrando fallback legível): "${name}"`,
    );
  }
  return name.replace(/_/g, " ").trim();
}

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
