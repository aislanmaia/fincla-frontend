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

export function mapCatsToLegacy(cats) {
  if (!Array.isArray(cats) || cats.length === 0) return "todas";
  // Backend aceita só uma; enviamos a primeira.
  return cats[0];
}

/**
 * Devolve o objeto consumido por `buildTransactionsQuery` / `useTransactionsData`.
 */
export function filtersToLegacyParams(state, { limit, debouncedSearch = "" } = {}) {
  return {
    search: debouncedSearch,
    filterType: mapTypeToLegacy(state.type),
    filterCat: mapCatsToLegacy(state.cats),
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
