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
 * canônico do seed (EN ou PT) — e quando a tag não for confirmadamente do
 * usuário. `is_default === false` é o único sinal confiável de "não é a
 * linha do seed": uma categoria do usuário chamada literalmente "Health" ou
 * "Renda" não pode ser reescrita só porque o texto coincide com o mapa
 * canônico.
 *
 * Por que o nome usa `!== false` (não `=== true`) como portão, diferente do
 * `icon_key` abaixo: os endpoints de agregação do consultor
 * (`/analytics/by-category`, `/consultant/expenses-by-category`) NUNCA
 * trazem `is_default` no payload — um deles nem passa pela tabela de tags,
 * agrega direto pela string livre `transaction.category`. Exigir
 * `=== true` pro NOME apagaria a tradução dessas telas por completo. Como só
 * sabemos que uma tag é do usuário quando o backend manda
 * `is_default: false` explicitamente, é esse o único caso que bloqueia a
 * tradução pelo nome; `true` ou "campo ausente" seguem o mapa EN/PT normal.
 *
 * `icon_key` é mais perigoso que o nome (uma categoria renomeada mantém o
 * `icon_key` do seed, então ele nunca deixa de "parecer" a categoria
 * original) — por isso o portão dele é estrito, `=== true`: só entra como
 * rede de segurança para uma linha CONFIRMADAMENTE do seed cujo nome não
 * bateu com o mapa (nunca pros dois endpoints de agregação acima, que
 * também não mandam `icon_key`, então isso não os afeta de qualquer forma).
 * @param {{ name?: string | null; icon_key?: string | null; is_default?: boolean | null } | Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function categoryLabelPtForTag(tag) {
  if (!tag) return "Categoria";
  const { name, icon_key: rawIk, is_default } = coerceCategoryTagShape(
    /** @type {Record<string, unknown>} */ (tag),
  );
  const isConfirmedSeedRow = is_default === true;
  const isConfirmedUserTag = is_default === false;
  if (!name) {
    if (isConfirmedSeedRow) {
      const ikNorm = normalizeCategoryIconKey(rawIk);
      if (ikNorm && CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm]) {
        return CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm];
      }
    }
    return "Categoria";
  }
  if (isConfirmedUserTag) return name;
  const fromEn = labelPtFromEnglishCategoryName(name);
  if (fromEn) return fromEn;
  const fromPt = labelPtFromPortugueseCategoryName(name);
  if (fromPt) return fromPt;
  if (isConfirmedSeedRow) {
    const ikNorm = normalizeCategoryIconKey(rawIk);
    if (ikNorm && CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm]) {
      return CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm];
    }
  }
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

  const { name, icon_key: rawIk, is_default } = coerceCategoryTagShape(o);
  const labelPt = categoryLabelPtForTag({ name, icon_key: rawIk, is_default });
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

/**
 * Rótulo PT para uma tag "detalhe" (subcategoria). Cobre o seed canônico acima
 * — mas só quando a tag É de fato a linha do seed: `is_default !== true`
 * (tag criada pelo usuário, sempre `is_default: false` no backend) passa
 * direto, sem tradução. Sem essa checagem, um usuário que cria sua própria
 * tag chamada "App" ou "Bar" tem o nome sequestrado pelo mapa (ela não é a
 * linha do seed, só coincide o texto) e não acha mais a própria tag.
 *
 * Fallback quando `is_default === true` mas o nome não está no mapa: nunca
 * devolve o slug cru — humaniza (`_` → espaço) e devolve, SEM avisar no
 * console. Por quê: o backend nunca reseta `is_default` ao renomear uma tag
 * semeada (confirmado por investigação no backend, issue #100), então esse
 * shape (`is_default: true`, nome fora do mapa) é indistinguível entre "dado
 * legado de uma migração antiga" e "tag do seed renomeada de propósito pra
 * um nome de escolha da pessoa" — o caso comum. Sem um sinal do backend que
 * diferencie os dois (ex. `renamed_at`), avisar aqui vira ruído em toda
 * renomeação legítima. Mesmo trade-off já aceito em `categoryLabelPtForTag`
 * (rede de segurança do `icon_key`, teste "[trade-off conhecido]") — alinha
 * as duas metades da correção pra não acusar um nome legítimo.
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
