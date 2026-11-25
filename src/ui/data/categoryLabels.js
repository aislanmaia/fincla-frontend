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
 * @returns {{ name: string | null; icon_key: string | null; custom_name: string | null; system_key: string | null; is_default: boolean | null }}
 */
export function coerceCategoryTagShape(raw) {
  if (!raw || typeof raw !== "object") return { name: null, icon_key: null, custom_name: null, system_key: null, is_default: null };
  const o = raw;
  const name =
    (typeof o.label === "string" && o.label.trim()) ||
    (typeof o.tag_label === "string" && o.tag_label.trim()) ||
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
  const custom_name =
    (typeof o.custom_name === "string" && o.custom_name.trim()) ||
    (typeof o.customName === "string" && o.customName.trim()) ||
    null;
  const system_key =
    (typeof o.system_key === "string" && o.system_key.trim()) ||
    (typeof o.systemKey === "string" && o.systemKey.trim()) ||
    (typeof o.tag_system_key === "string" && o.tag_system_key.trim()) ||
    null;
  return { name, icon_key, custom_name, system_key, is_default };
}

export const CATEGORY_LABEL_PT_BY_ICON_KEY = {
  "shopping-cart": "Alimentação",
  car: "Transporte",
  pill: "Saúde",
  "book-open": "Educação",
  "party-popper": "Lazer e entretenimento",
  "shopping-bag": "Compras pessoais",
  wrench: "Serviços",
  smartphone: "Assinaturas e software",
  receipt: "Impostos e taxas",
  home: "Moradia",
  wallet: "Receita",
  "circle-help": "Não classificado",
};

/** Nomes canônicos em inglês retornados pelo seed (variações comuns). */
export const CATEGORY_LABEL_PT_BY_EN_NAME = {
  "Food & Groceries": "Alimentação",
  Transport: "Transporte",
  Health: "Saúde",
  Education: "Educação",
  "Leisure & Entertainment": "Lazer e entretenimento",
  "Personal Shopping": "Compras pessoais",
  Services: "Serviços",
  "Subscriptions & Software": "Assinaturas e software",
  "Taxes & Fees": "Impostos e taxas",
  Housing: "Moradia",
  Income: "Receita",
  Uncategorized: "Não classificado",
  // Demais categorias do catálogo do backend
  // (fincla-api/src/infrastructure/database/seeds/system_category_catalog.py,
  // `pt_br_label`). Sem elas a categoria de receita aparece em inglês
  // ("Services Provided") nas telas que traduzem pelo nome.
  "Financing & Debt": "Financiamentos e dívidas",
  Donations: "Doações",
  Pets: "Animais de estimação",
  Travel: "Viagens",
  "Work & Personal Business": "Trabalho e negócios pessoais",
  "Work & Salary": "Trabalho e salário",
  "Services Provided": "Serviços prestados",
  Sales: "Vendas",
  Benefits: "Benefícios",
  "Rental Income": "Aluguéis recebidos",
  "Investment Returns": "Rendimentos",
  "Received Transfers": "Transferências recebidas",
  "Received Reimbursements": "Reembolsos recebidos",
};

const CATEGORY_LABEL_PT_BY_EN_NAME_NORMALIZED = Object.fromEntries(
  Object.entries(CATEGORY_LABEL_PT_BY_EN_NAME).map(([en, pt]) => [
    normalizeCategoryLookupKey(en),
    pt,
  ]),
);

/** Variações de nome que alguns backends enviam fora do canônico do guia → rótulo PT. */
const CATEGORY_EN_NAME_ALIASES = {
  "food and groceries": "Alimentação",
  "leisure and entertainment": "Lazer e entretenimento",
  "personal shopping": "Compras pessoais",
  "subscriptions & software": "Assinaturas e software",
  "subscriptions and software": "Assinaturas e software",
  "taxes & fees": "Impostos e taxas",
  "taxes and fees": "Impostos e taxas",
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
 * O nome que a tela mostra para uma categoria: o nome exato que a API entrega
 * (fincla-api#534). A API já aplica a regra `tag_display_label` — o nome da
 * organização, senão o rótulo do catálogo no idioma — em listagem, facetas,
 * resumo e fatura, e é esse mesmo nome que vai no arquivo exportado. A tela
 * não reescreve um nome que já veio em pt-BR (nem caixa, nem "e" × "&").
 *
 * O mapa EN → pt-BR é só reserva para uma resposta que não localizou e mandou
 * o nome cru do sistema em inglês ("Personal Shopping"); ele devolve o rótulo
 * do catálogo letra por letra, para a tela e o arquivo seguirem iguais.
 * `is_default === false` (tag criada pela organização) bloqueia até essa
 * reserva: uma categoria do usuário chamada "Health" fica "Health".
 *
 * `icon_key` só nomeia uma linha do seed que chegou SEM nome nenhum. Com nome
 * presente ele nunca o sobrepõe: uma categoria renomeada mantém o `icon_key`
 * do seed, e deixá-lo decidir trocava o nome da organização pelo do catálogo.
 * @param {{ name?: string | null; icon_key?: string | null; is_default?: boolean | null } | Record<string, unknown> | null | undefined} tag
 * @returns {string}
 */
export function categoryLabelPtForTag(tag) {
  if (!tag) return "Categoria";
  const { name, icon_key: rawIk, custom_name: customName, is_default } = coerceCategoryTagShape(
    /** @type {Record<string, unknown>} */ (tag),
  );
  if (customName) return customName;
  if (!name) {
    if (is_default === true) {
      const ikNorm = normalizeCategoryIconKey(rawIk);
      if (ikNorm && CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm]) {
        return CATEGORY_LABEL_PT_BY_ICON_KEY[ikNorm];
      }
    }
    return "Categoria";
  }
  if (is_default === false) return name;
  return labelPtFromEnglishCategoryName(name) ?? name;
}

const CATEGORY_COLOR_BY_LABEL_PT = {
  "Alimentação": "#059669",
  Transporte: "#2563EB",
  Saúde: "#DC2626",
  Educação: "#7C3AED",
  "Lazer e entretenimento": "#D97706",
  Lazer: "#D97706",
  "Compras pessoais": "#DC2626",
  Serviços: "#6B7280",
  "Assinaturas e software": "#0891B2",
  Assinaturas: "#7C3AED",
  "Impostos e taxas": "#D97706",
  Moradia: "#6B7280",
  Receita: "#059669",
  Renda: "#059669",
  Outros: "#374151",
  Vestuário: "#BE185D",
  // Atalhos dos dados de demonstração (Transações e cartões).
  Streaming: "#7C3AED",
  Compras: "#0891B2",
  Casa: "#64748B",
  Eletrônicos: "#0891B2",
  Viagem: "#0D9488",
};

/** Busca de cor sem depender de caixa, acento ou "e" × "&" — a cor é da categoria, não da grafia. */
const CATEGORY_COLOR_BY_LOOKUP_KEY = Object.fromEntries(
  Object.entries(CATEGORY_COLOR_BY_LABEL_PT).map(([label, color]) => [colorLookupKey(label), color]),
);

function colorLookupKey(value) {
  return normalizeCategoryLookupKey(value)
    .split(" ")
    .filter((word) => word && word !== "e")
    .join(" ");
}

/**
 * A cor de uma categoria pelo rótulo, ou `null` se ela não está no mapa. O mapa
 * ÚNICO de cores (G3-P-10): Transações, cartões e a resolução por tag leem
 * daqui — um nome novo do catálogo entra num lugar só.
 * @param {string | null | undefined} label
 * @returns {string | null}
 */
export function categoryColorForLabel(label) {
  if (label == null || label === "") return null;
  return CATEGORY_COLOR_BY_LOOKUP_KEY[colorLookupKey(label)] ?? null;
}

/**
 * Categorias do sistema por `system_key` (catálogo do backend,
 * fincla-api/src/infrastructure/database/seeds/system_category_catalog.py):
 * o rótulo do mapa de cores acima e, para as que não estão nele, a cor do seed.
 * A chave não muda quando a organização renomeia a categoria; o rótulo muda.
 */
const SYSTEM_CATEGORY_COLOR_SOURCE = {
  food_groceries: ["Alimentação", "#059669"],
  housing: ["Moradia", "#6B7280"],
  transport: ["Transporte", "#2563EB"],
  health: ["Saúde", "#DC2626"],
  education: ["Educação", "#7C3AED"],
  leisure_entertainment: ["Lazer e entretenimento", "#D97706"],
  personal_shopping: ["Compras pessoais", "#BE185D"],
  services: ["Serviços", "#64748B"],
  subscriptions_software: ["Assinaturas e software", "#0891B2"],
  taxes_fees: ["Impostos e taxas", "#A16207"],
  financing_debt: ["Financiamentos e dívidas", "#B45309"],
  donations: ["Doações", "#C2410C"],
  pets: ["Animais de estimação", "#92400E"],
  travel: ["Viagem", "#0369A1"],
  work_personal_business: ["Trabalho e negócios pessoais", "#4338CA"],
  work_salary: ["Trabalho e salário", "#15803D"],
  services_provided: ["Serviços prestados", "#15803D"],
  sales: ["Vendas", "#15803D"],
  benefits: ["Benefícios", "#15803D"],
  rental_income: ["Aluguéis recebidos", "#15803D"],
  investment_returns: ["Rendimentos", "#15803D"],
  received_transfers: ["Transferências recebidas", "#15803D"],
  received_reimbursements: ["Reembolsos recebidos", "#15803D"],
};

const CATEGORY_COLOR_BY_SYSTEM_KEY = Object.fromEntries(
  Object.entries(SYSTEM_CATEGORY_COLOR_SOURCE).map(([key, [label, seedColor]]) => [
    key,
    categoryColorForLabel(label) ?? seedColor,
  ]),
);

/**
 * A cor de uma categoria, ou `null`. Regra única de todas as telas
 * (Transações, cartão, Resumo do recorte, Visão Geral, Relatórios):
 * 1. a cor da própria categoria vinda da API (`tag.color`): é a que a pessoa
 *    edita em Configurações → Categorias e, sem edição, a do catálogo do backend;
 * 2. sem ela, a cor pela chave estável (`system_key`): a categoria do sistema
 *    renomeada mantém a cor (QA display-and-pagination, BUG-02);
 * 3. sem ela, o mapa único por rótulo (`categoryColorForLabel`).
 * @param {{ color?: string | null; systemKey?: string | null; label?: string | null }} [category]
 * @returns {string | null}
 */
export function categoryColorForCategory({ color = null, systemKey = null, label = null } = {}) {
  const own = typeof color === "string" ? color.trim() : "";
  if (own) return own;
  const key = typeof systemKey === "string" ? systemKey.trim() : "";
  if (key && CATEGORY_COLOR_BY_SYSTEM_KEY[key]) return CATEGORY_COLOR_BY_SYSTEM_KEY[key];
  return categoryColorForLabel(label);
}

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
 * Resolve uma cor estável para a tag de categoria, pela regra única de
 * `categoryColorForCategory` (cor da API > chave do sistema > rótulo) e, por
 * fim, uma paleta fixa não-cinza baseada no nome/ícone da categoria.
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
  const known = categoryColorForCategory({ color: explicitColor, systemKey: coerceCategoryTagShape(o).system_key });
  if (known) return known;

  const { name, icon_key: rawIk, is_default } = coerceCategoryTagShape(o);
  const labelPt = categoryLabelPtForTag({ name, icon_key: rawIk, is_default });
  const canonical = labelPt ? CATEGORY_COLOR_BY_LOOKUP_KEY[colorLookupKey(labelPt)] : null;
  if (canonical) return canonical;

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
  // Grafia antiga da tela (dados de demonstração), antes de seguir o catálogo (fincla-api#534).
  "Lazer & Entretenimento": "party-popper",
  "Compras Pessoais": "shopping-bag",
  "Assinaturas & Software": "smartphone",
  "Impostos & Taxas": "receipt",
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
 * devolve o slug cru — humaniza (`_` → espaço) e devolve. Não avisa no
 * console de PRODUÇÃO. Por quê: o backend nunca reseta `is_default` ao
 * renomear uma tag semeada (confirmado por investigação no backend, issue
 * #100), então esse shape (`is_default: true`, nome fora do mapa) é
 * indistinguível entre "dado legado de uma migração antiga / slug novo do
 * seed" e "tag do seed renomeada de propósito pra um nome de escolha da
 * pessoa" — o caso comum. Sem um sinal do backend que diferencie os dois
 * (ex. `renamed_at`), avisar pra todo mundo vira ruído em toda renomeação
 * legítima. Mesmo trade-off já aceito em `categoryLabelPtForTag` (rede de
 * segurança do `icon_key`, teste "[trade-off conhecido]") — alinha as duas
 * metades da correção pra não acusar um nome legítimo.
 *
 * MAS o aviso ainda tem valor pra quem PODE agir (o time de dev rodando
 * localmente, não o usuário final): só em `import.meta.env.DEV` (nunca em
 * build de produção), avisa quando o nome não bate com o mapa — sinal de
 * drift entre `DETAIL_LABEL_PT_BY_EN_NAME` e o seed do backend
 * (`CANONICAL_CATEGORY_SEED`) que o teste estático de
 * `categoryLabels.test.js` não cobre (ele só pega edição acidental do
 * mapa, nunca um slug novo que o backend passou a semear — achado 6 da
 * rodada 3, restaurado no achado 5 da rodada 4 de review #100).
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
  if (import.meta.env?.DEV) {
    console.warn(
      `[categoryLabels] tag "detalhe" sem tradução PT no mapa (só em DEV — nunca aparece pra usuário em produção): "${name}". Pode ser um slug novo do seed do backend (confira DETAIL_LABEL_PT_BY_EN_NAME) ou uma renomeação legítima — não é necessariamente um bug.`,
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
