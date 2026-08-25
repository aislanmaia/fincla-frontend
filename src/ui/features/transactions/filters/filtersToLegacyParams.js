/**
 * Adapter entre o estado novo da Variação C (`useTransactionsFilterState`)
 * e os parâmetros legados consumidos por `buildTransactionsQuery` /
 * `useTransactionsData` (que falam com o backend).
 *
 * Algumas limitações do contrato atual:
 *  - O sort do backend é único; enviamos o primeiro critério da lista multi-nível.
 *  - Situação (`settlement`) vira `?settled=` na lista e no summary.
 *  - Recorrência (`rec`) vira `?recurring=` nos dois.
 *
 * Categoria e Tags deixaram de disputar um slot: `category` e `tag_id` são
 * params REPETÍVEIS que casam com qualquer valor dentro da mesma chave e se
 * combinam entre chaves por AND. Mandamos a seleção inteira das duas.
 *
 * Forma de pagamento é multi-seleção: o backend casa com qualquer um dos valores
 * enviados (param `payment_method` repetido), então mandamos todos os métodos
 * marcados — sem recorte client-side.
 *
 * Tags (facet "Tags", `state.tags`): a facet guarda NOMES de tag (o `TagPanel`
 * só trabalha com nomes) e o backend filtra por `tag_id` (UUID). O chamador
 * (`TransacoesPage`) resolve nome→id via o catálogo de tags "detalhe" da
 * organização e manda o resultado em `options.tagIds`.
 */

import { parseMoneyInput } from "../../onboarding/onboardingValueUtils.js";
import { mapUiPaymentMethodToApi } from "../../../data/transactionsAdapter.js";

const SORT_FIELD_TO_LEGACY = {
  date: { asc: "date-asc", desc: "date-desc" },
  val: { asc: "val-asc", desc: "val-desc" },
  desc: { asc: "name-asc", desc: "name-desc" },
  /* `tipo` e `cat` TÊM equivalente: a API aceita `sort_by=type` e
     `sort_by=category`. Enquanto não tinham token aqui, escolher "Ordenar por
     Tipo" trocava o rótulo do botão e não mexia uma linha da lista — o pior
     tipo de defeito, o que responde ao clique sem fazer nada. */
  tipo: { asc: "type-asc", desc: "type-desc" },
  cat: { asc: "cat-asc", desc: "cat-desc" },
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
 * Mapeamento da seleção multi do front para `filterCat`:
 *  - vazia → "todas" (sem filtro)
 *  - todas selecionadas (clicar "Todas" na UI) → "todas" (equivalente a sem filtro)
 *  - qualquer outra → a lista INTEIRA, que o adapter reparte entre `category`
 *    (nomes) e `tag_id` (UUIDs) como params repetidos.
 */
export function mapCatsToLegacy(cats, totalCategories) {
  if (!Array.isArray(cats) || cats.length === 0) return "todas";
  if (typeof totalCategories === "number" && totalCategories > 0 && cats.length >= totalCategories) {
    return "todas";
  }
  return cats;
}

/**
 * Junta as duas facets num único valor para `buildTransactionsQuery`, que separa
 * nomes de UUIDs na hora de montar a query. As duas convivem: `category` e
 * `tag_id` se combinam por AND no backend, então marcar uma categoria E uma tag
 * pede a interseção — que é o que a tela mostra acesa.
 */
export function mapCatsOrTagToLegacy(cats, tagIds, totalCategories) {
  const catValue = mapCatsToLegacy(cats, totalCategories);
  const catList = catValue === "todas" ? [] : catValue;
  const tagList = Array.isArray(tagIds) ? tagIds.filter(Boolean) : [];
  const merged = [...catList, ...tagList];
  return merged.length ? merged : "todas";
}

/** `rec` da UI → `?recurring=` do backend. "any" não manda nada. */
export function mapRecToLegacy(rec) {
  if (rec === "yes") return true;
  if (rec === "no") return false;
  return undefined;
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
    recurring: mapRecToLegacy(state.rec),
    // Só viaja quando é "all": "any" é o default do backend, e mandá-lo
    // explicitamente só engorda a query e a assinatura de cache.
    ...(state.tagMode === "all" ? { tagMatch: "all" } : {}),
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
