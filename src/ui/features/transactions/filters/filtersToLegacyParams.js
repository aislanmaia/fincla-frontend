/**
 * Adapter entre o estado novo da Variação C (`useTransactionsFilterState`)
 * e os parâmetros legados consumidos por `buildTransactionsQuery` /
 * `useTransactionsData` (que falam com o backend).
 *
 * Algumas limitações do contrato atual:
 *  - O backend aceita UMA categoria (`filterCat`); enviamos a primeira da seleção.
 *  - O sort do backend é único; enviamos o primeiro critério da lista multi-nível.
 *  - Recorrência (`rec`) ainda não tem filtro correspondente no backend.
 *  - Situação (`settlement`) tem: vira `?settled=` na lista e no summary.
 *
 * Forma de pagamento é multi-seleção: o backend casa com qualquer um dos valores
 * enviados (param `payment_method` repetido), então mandamos todos os métodos
 * marcados — sem recorte client-side.
 *
 * Tags (facet "Tags", `state.tags`): fincla-frontend#78 — a facet guarda NOMES
 * de tag (o `TagPanel` só trabalha com nomes), mas o único param que o backend
 * entende é `GET /v1/transactions?tag_id=<uuid>` — um único id, de qualquer
 * tipo de tag (fincla-api/docs/FRONTEND_API_GUIDE.md linha ~2818). Antes desta
 * correção o nome nunca era resolvido para um id nem repassado a
 * `buildTransactionsQuery`: a seleção ficava só no estado local, sem nunca
 * chegar à query — por isso marcar uma tag não mudava a listagem. O chamador
 * (`TransacoesPage`) resolve nome→id via o catálogo de tags "detalhe" da
 * organização (`useNovaTransacaoDetailTags`) e manda o resultado em
 * `options.tagIds`; aqui ele compete pelo MESMO slot `filterCat` que a
 * categoria usa (o backend só aceita um `tag_id`) — categoria tem prioridade
 * quando as duas facets estão preenchidas, e isso é uma limitação real do
 * contrato (backend não faz AND entre duas tags), não um bug.
 */

import { parseMoneyInput } from "../../onboarding/onboardingValueUtils.js";
import { mapUiPaymentMethodToApi } from "../../../data/transactionsAdapter.js";

const SORT_FIELD_TO_LEGACY = {
  date: { asc: "date-asc", desc: "date-desc" },
  val: { asc: "val-asc", desc: "val-desc" },
  desc: { asc: "name-asc", desc: "name-desc" },
  // "tipo" e "cat" não têm equivalente direto na API; caem no default
};

export function mapSortToLegacy(sort) {
  if (!Array.isArray(sort) || sort.length === 0) return "date-desc";
  const first = sort[0];
  const entry = SORT_FIELD_TO_LEGACY[first.field];
  if (!entry) return "date-desc";
  return entry[first.dir] || "date-desc";
}

export function mapTypeToLegacy(type) {
  if (type === "receita") return "receita";
  if (type === "despesa") return "despesa";
  return "todos";
}

/**
 * Converte a seleção de formas de pagamento da UI (`["pix", "credito"]`) nos
 * valores da API (`["pix", "credit_card"]`). Seleção vazia → `[]` (sem filtro).
 * O backend casa com qualquer um dos valores enviados.
 */
export function mapMethodToLegacy(method) {
  if (!Array.isArray(method) || method.length === 0) return [];
  return method.map(mapUiPaymentMethodToApi);
}

/**
 * Backend aceita um único `filterCat`. Mapeamento da seleção multi do front:
 *  - vazia → "todas" (sem filtro)
 *  - todas selecionadas (clicar "Todas" na UI) → "todas" (equivalente a sem filtro)
 *  - 1 categoria → o id dela
 *  - >1 mas não todas → primeira da lista (limitação registrada do contrato atual)
 */
export function mapCatsToLegacy(cats, totalCategories) {
  if (!Array.isArray(cats) || cats.length === 0) return "todas";
  if (typeof totalCategories === "number" && totalCategories > 0 && cats.length >= totalCategories) {
    return "todas";
  }
  return cats[0];
}

/**
 * Resolve o único slot `filterCat`/`tag_id` que o backend aceita, priorizando a
 * facet "Categoria" (`cats`) sobre a facet "Tags" (`tagIds`, já resolvidos para
 * UUID pelo chamador) quando as duas estão preenchidas ao mesmo tempo — ver nota
 * de topo do arquivo (fincla-frontend#78).
 */
export function mapCatsOrTagToLegacy(cats, tagIds, totalCategories) {
  const catValue = mapCatsToLegacy(cats, totalCategories);
  if (catValue !== "todas") return catValue;
  if (Array.isArray(tagIds) && tagIds.length) return tagIds[0];
  return "todas";
}

/** Converte strings BRL ("200,00") em números para `value_min`/`value_max` da API. */
export function mapValueRangeToLegacy(valueMin, valueMax) {
  const min = parseMoneyInput(valueMin);
  const max = parseMoneyInput(valueMax);
  return {
    ...(min != null ? { valueMin: min } : {}),
    ...(max != null ? { valueMax: max } : {}),
  };
}

/** Filtro client-side (mock): compara valor absoluto da transação com a faixa informada. */
export function matchesValueRange(absAmount, valueMin, valueMax) {
  if (!valueMin && !valueMax) return true;
  const min = parseMoneyInput(valueMin);
  const max = parseMoneyInput(valueMax);
  if (min != null && absAmount < min) return false;
  if (max != null && absAmount > max) return false;
  return true;
}

/**
 * Devolve o objeto consumido por `buildTransactionsQuery` / `useTransactionsData`.
 *
 * @param {object} state - estado dos filtros (do `useTransactionsFilterState`)
 * @param {object} options
 * @param {number} options.limit - limite do paginador
 * @param {string} options.debouncedSearch - termo de busca já estabilizado
 * @param {number} [options.totalCategories] - total de categorias disponíveis;
 *   quando informado, permite detectar "Todas selecionadas" e mapear para o
 *   filtro vazio do backend (caso contrário ele aceitaria só a primeira).
 * @param {string[]} [options.tagIds] - ids das tags de `state.tags` (nomes) já
 *   resolvidos pelo chamador; ver nota de topo do arquivo (fincla-frontend#78).
 */
export function filtersToLegacyParams(
  state,
  { limit, debouncedSearch = "", totalCategories, tagIds } = {},
) {
  return {
    search: debouncedSearch,
    filterType: mapTypeToLegacy(state.type),
    filterCat: mapCatsOrTagToLegacy(state.cats, tagIds, totalCategories),
    filterMethod: mapMethodToLegacy(state.method),
    period: state.period,
    customFrom: state.customFrom,
    customTo: state.customTo,
    sortBy: mapSortToLegacy(state.sort),
    ...mapValueRangeToLegacy(state.valueMin, state.valueMax),
    // Vai para a lista E para o summary: `buildTransactionsSummaryQuery` recebe o
    // mesmo objeto, então o card de totais e a lista não podem descrever conjuntos
    // diferentes de linhas.
    settlement: state.settlement ?? "todas",
    limit,
  };
}

/**
 * Mesma forma do `buildTransactionsCsvOptions` legado.
 */
export function filtersToCsvOptions(state) {
  return {
    filterType: mapTypeToLegacy(state.type),
    filterMethod: mapMethodToLegacy(state.method),
    period: state.period,
    customFrom: state.customFrom,
    customTo: state.customTo,
  };
}
