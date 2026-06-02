/**
 * Adapter entre o estado novo da Variação C (`useTransactionsFilterState`)
 * e os parâmetros legados consumidos por `buildTransactionsQuery` /
 * `useTransactionsData` (que falam com o backend).
 *
 * Algumas limitações do contrato atual:
 *  - O backend aceita UMA categoria (`filterCat`); enviamos a primeira da seleção.
 *  - Não há `method`/forma de pagamento na Variação C (foi removido do design);
 *    sempre enviamos "todos".
 *  - O sort do backend é único; enviamos o primeiro critério da lista multi-nível.
 *  - Faixa de valor (`valueMin`/`valueMax`) e recorrência (`rec`) não têm filtros
 *    correspondentes no contrato atual — são aplicados client-side quando em modo mock,
 *    e ignorados quando em modo live (até o backend suportar).
 */

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
    filterMethod: "todos",
    period: state.period,
    customFrom: state.customFrom,
    customTo: state.customTo,
    sortBy: mapSortToLegacy(state.sort),
    limit,
  };
}

/**
 * Mesma forma do `buildTransactionsCsvOptions` legado.
 */
export function filtersToCsvOptions(state) {
  return {
    filterType: mapTypeToLegacy(state.type),
    filterMethod: "todos",
    period: state.period,
    customFrom: state.customFrom,
    customTo: state.customTo,
  };
}
