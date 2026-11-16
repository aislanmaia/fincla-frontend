import { invoiceItemTagNames, mapInvoiceItemToUi } from "../../data/creditCardsAdapter.js";
import { matchesValueRange } from "../transactions/filters/filtersToLegacyParams.js";
import { parseMoneyInput } from "../onboarding/onboardingValueUtils.js";
import { parseMoneyInputFor } from "../../money/moneyInput.js";

const amountOf = (value) => {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const transactionDateKey = (value) => /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value ?? "")?.[1] ?? "";

export function invoiceRows(items, { search = "", cats = [], tags = [], tagMode = "any", modality = "all", from = "", to = "", valueMin = "", valueMax = "", valueCurrency = null } = {}) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return (items ?? [])
    .map((item) => {
      const row = mapInvoiceItemToUi(item);
      const date = transactionDateKey(item.transaction_date);
      return {
        ...row,
        data: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "—",
        dataKey: date,
        purchaseDate: item.purchase_info?.purchase_date ?? null,
        categoryId: item.tags?.categoria?.[0]?.id ?? "uncategorized",
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "",
        transactionDate: date,
        // A busca olha a descrição como foi gravada, a mesma que `description` da API compara (#525): sem o
        // prefixo "Estorno:" da tela e sem o nome da categoria (que tem filtro próprio).
        rawDescription: String(item.description ?? ""),
      };
    })
    .filter((row) => (
      (!query || row.rawDescription.toLocaleLowerCase("pt-BR").includes(query)) &&
      (cats.length === 0 || cats.includes(row.categoryId)) &&
      (tags.length === 0 || (tagMode === "all" ? tags.every((tag) => row.tags.includes(tag)) : tags.some((tag) => row.tags.includes(tag)))) &&
      (modality === "all" || row.modality === modality) &&
      (!from || row.transactionDate >= from) && (!to || row.transactionDate <= to) &&
      (row.val == null ? !valueMin && !valueMax : matchesValueRange(Math.abs(row.val), valueMin, valueMax, valueCurrency))
    ));
}

export function categoryOptions(breakdown) {
  return (breakdown ?? []).filter((row) => row.category_name)
    .map((row) => ({ id: row.category_id == null ? "uncategorized" : String(row.category_id), name: row.category_name, color: row.category_color }));
}

export function tagOptions(items) {
  return [...new Set((items ?? []).flatMap(invoiceItemTagNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function weeklySpending(items) {
  const dates = (items ?? []).map((item) => transactionDateKey(item.transaction_date)).filter(Boolean).sort();
  if (dates.length === 0) return [];
  const start = new Date(`${dates[0]}T12:00:00`);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(`${dates.at(-1)}T12:00:00`);
  const buckets = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 7)) {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    buckets.push({ key, label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), amount: 0, hasData: false });
  }
  for (const item of items ?? []) {
    const dateKey = transactionDateKey(item.transaction_date);
    if (!dateKey) continue;
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const bucket = buckets.find((row) => row.key === key);
    const amount = amountOf(item.amount);
    if (!bucket || amount === null) continue;
    bucket.hasData = true;
    bucket.amount += item.modality === "refund" ? -amount : amount;
  }
  return buckets;
}

const UNCATEGORIZED = "uncategorized";

/**
 * Os filtros de "Lançamentos da fatura" como parâmetros de `GET /v1/transactions` (export e resumo; fincla-api#525).
 * A tela filtra no navegador sobre as linhas da fatura; o arquivo sai do servidor. Cada filtro da tela tem aqui o
 * parâmetro que devolve EXATAMENTE as mesmas linhas:
 * - fatura → `credit_card_id` + `invoice_id` (as linhas da fatura são os lançamentos com esse `invoice_id`);
 * - busca → `description` (a busca da tela olha só a descrição gravada, como a da API);
 * - período → `date_start`/`date_end` (a data da linha é a do lançamento, a mesma que a API compara);
 * - categoria → `category` pelo nome da categoria (a API casa o nome da etiqueta de categoria);
 * - etiquetas → `tag_id` (os ids das etiquetas com esses nomes, tirados das próprias linhas) + `tag_match`;
 * - modalidade → `modality` (a mesma modalidade que a fatura informa em cada linha);
 * - valor → `value_min`/`value_max`, lidos na moeda da fatura como a tela lê (os valores gravados são positivos).
 *
 * Quando um filtro NÃO tem tradução exata, devolve `blocked` com o motivo em vez de mandar um recorte diferente
 * do que a tela mostra: linhas "Sem Categoria" (sem etiqueta de categoria), duas categorias desta fatura com o
 * mesmo nome e só uma marcada, ou uma etiqueta com nome repetido no modo "todas".
 */
export function invoiceExportFilter({ organizationId, cardId, invoiceId, items, categories = [], search = "", cats = [], tags = [], tagMode = "any", modality = "all", from = "", to = "", valueMin = "", valueMax = "", valueCurrency = null }) {
  if (invoiceId == null) return { params: null, blocked: "Esta fatura ainda não tem lançamentos para exportar." };
  const params = { organization_id: organizationId, credit_card_id: cardId, invoice_id: [invoiceId] };
  const query = search.trim();
  if (query) params.description = query;
  if (from) params.date_start = from;
  if (to) params.date_end = to;
  if (cats.length) {
    if (cats.includes(UNCATEGORIZED)) return { params: null, blocked: "O filtro \"Sem Categoria\" ainda não pode ser exportado. Tire-o para exportar." };
    const byId = new Map(categories.map((row) => [String(row.id), row]));
    const names = cats.map((id) => byId.get(String(id))?.name).filter(Boolean);
    const lower = new Set(names.map((name) => name.toLocaleLowerCase("pt-BR")));
    const ambiguous = categories.some((row) => !cats.includes(String(row.id)) && lower.has(String(row.name).toLocaleLowerCase("pt-BR")));
    if (names.length !== cats.length || ambiguous) {
      return { params: null, blocked: "Há categorias com o mesmo nome nesta fatura; o arquivo não as separa. Ajuste o filtro de categoria para exportar." };
    }
    params.category = names;
  }
  if (tags.length) {
    const idsByName = new Map();
    for (const item of items ?? []) {
      for (const [type, values] of Object.entries(item.tags ?? {})) {
        if (type === "categoria") continue;
        for (const tag of values ?? []) {
          if (!tag?.name || !tag?.id) continue;
          if (!idsByName.has(tag.name)) idsByName.set(tag.name, new Set());
          idsByName.get(tag.name).add(String(tag.id));
        }
      }
    }
    const groups = tags.map((name) => [...(idsByName.get(name) ?? [])]);
    if (tagMode === "all" && groups.some((ids) => ids.length > 1)) {
      return { params: null, blocked: "Há etiquetas com o mesmo nome nesta fatura; no modo \"todas\" o arquivo não as separa. Ajuste o filtro de etiquetas para exportar." };
    }
    params.tag_id = [...new Set(groups.flat())];
    params.tag_match = tagMode === "all" ? "all" : "any";
    // Nenhuma linha carrega a etiqueta: a tela mostra zero linhas, e o pedido também tem de vir vazio.
    if (params.tag_id.length === 0) return { params: null, blocked: "Nenhum lançamento corresponde aos filtros." };
  }
  if (modality === "cash" || modality === "installment" || modality === "refund") params.modality = modality;
  const min = valueMin ? parseMoneyInputFor(valueMin, valueCurrency, parseMoneyInput) : null;
  const max = valueMax ? parseMoneyInputFor(valueMax, valueCurrency, parseMoneyInput) : null;
  if (min != null) params.value_min = min;
  if (max != null) params.value_max = max;
  return { params, blocked: null };
}
