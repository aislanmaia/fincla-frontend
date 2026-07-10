/**
 * Adapter entre o estado novo da Variação C (`useTransactionsFilterState`)
 * e os parâmetros legados consumidos por `buildTransactionsQuery` /
 * `useTransactionsData` (que falam com o backend).
 *
 * Algumas limitações do contrato atual:
 *  - O backend aceita UMA categoria (`filterCat`); enviamos a primeira da seleção.
 *  - O sort do backend é único; enviamos o primeiro critério da lista multi-nível.
 *  - Recorrência (`rec`) ainda não tem filtro correspondente no backend.
 *
 * Forma de pagamento é multi-seleção: o backend casa com qualquer um dos valores
 * enviados (param `payment_method` repetido), então mandamos todos os métodos
 * marcados — sem recorte client-side.
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
 */
export function filtersToLegacyParams(
  state,
  { limit, debouncedSearch = "", totalCategories } = {},
) {
  return {
    search: debouncedSearch,
    filterType: mapTypeToLegacy(state.type),
    filterCat: mapCatsToLegacy(state.cats, totalCategories),
    filterMethod: mapMethodToLegacy(state.method),
    period: state.period,
    customFrom: state.customFrom,
    customTo: state.customTo,
    sortBy: mapSortToLegacy(state.sort),
    ...mapValueRangeToLegacy(state.valueMin, state.valueMax),
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
