import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCustomPeriodLabel } from "./customPeriodLabel.js";
import {
  getPaymentMethodLabel,
  isPaymentMethodAllowedForType,
} from "./paymentMethodOptions.js";
import { DEFAULT_SORT, sortItems as sortItemsFn } from "./search/sortModel.js";

/**
 * Estado canônico dos filtros + ordenação da página de Transações (Variação C).
 *
 * Filtros suportados (modelo interno):
 *   search:      string
 *   period:      "tudo" | "hoje" | "semana" | "mes" | "mes-ant" | "3m" | "ano" | "custom"
 *   customFrom:  "yyyy-mm-dd" (somente quando period === "custom")
 *   customTo:    "yyyy-mm-dd"
 *   type:        "todos" | "receita" | "despesa"
 *   method:      string[] (keys de forma de pagamento)
 *   cats:        string[] (ids de categorias)
 *   tags:        string[]
 *   cardSel:     string[] (ids de cartões)
 *   rec:         "any" | "yes" | "no"
 *   valueMin:    string (BRL parseável, vazio = sem mínimo)
 *   valueMax:    string
 *   sort:        Array<{ field, dir }>
 *
 * Esse hook não conhece a API: devolve o snapshot atual + setters. A página decide
 * como mapear para os parâmetros de `useTransactionsData` / `listTransactionsForUi`.
 */

export const DEFAULT_FILTER_STATE = Object.freeze({
  search: "",
  period: "mes",
  customFrom: "",
  customTo: "",
  type: "todos",
  method: [],
  cats: [],
  tags: [],
  cardSel: [],
  rec: "any",
  valueMin: "",
  valueMax: "",
});

function normalizeInitial(partial) {
  const next = { ...DEFAULT_FILTER_STATE, ...(partial || {}) };
  next.method = Array.isArray(next.method)
    ? next.method.filter(Boolean)
    : typeof next.method === "string" && next.method !== "todos" && next.method.trim()
      ? [next.method]
      : [];
  if (!isPaymentMethodAllowedForType(next.method, next.type)) next.method = [];
  return next;
}

export function useTransactionsFilterState({
  initial,
  initialSort = DEFAULT_SORT,
  onChange,
} = {}) {
  const [state, setState] = useState(() => normalizeInitial(initial));
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    if (typeof onChange === "function") onChange({ ...state, sort });
  }, [state, sort, onChange]);

  const setField = useCallback((field, value) => {
    setState((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
  }, []);

  const setType = useCallback((value) => {
    setState((prev) => {
      const nextMethod = isPaymentMethodAllowedForType(prev.method, value)
        ? prev.method
        : prev.method.filter((item) => isPaymentMethodAllowedForType(item, value));
      if (prev.type === value && prev.method === nextMethod) return prev;
      return { ...prev, type: value, method: nextMethod };
    });
  }, []);

  /** Restaura todo o estado (filtros + sort) para o snapshot fornecido. */
  const applySnapshot = useCallback((nextSnapshot) => {
    if (!nextSnapshot || typeof nextSnapshot !== "object") return;
    const next = normalizeInitial(nextSnapshot);
    setState(next);
    if (Array.isArray(nextSnapshot.sort) && nextSnapshot.sort.length) {
      setSort(nextSnapshot.sort);
    }
  }, []);

  /** Resgata o snapshot serializável atual — usado por NewViewForm e localStorage. */
  const snapshot = useMemo(() => ({ ...state, sort }), [state, sort]);

  const clearAll = useCallback(() => {
    setState(normalizeInitial());
    setSort(DEFAULT_SORT);
  }, []);

  /** Lista canônica de facets para a FacetBar, derivada do estado. */
  const buildFacets = useCallback(
    ({ categoriesById = {}, cardsById = {} } = {}) => {
      const presetPeriodLabels = {
        tudo: "Todo período",
        hoje: "Hoje",
        semana: "Esta semana",
        mes: "Este mês",
        "mes-ant": "Mês anterior",
        "3m": "Últimos 3m",
        ano: "Este ano",
      };
      const periodLabel =
        state.period === "custom"
          ? formatCustomPeriodLabel(state.customFrom, state.customTo)
          : presetPeriodLabels[state.period];

      return [
        {
          key: "periodo",
          label: "Período",
          value: periodLabel || "Este mês",
          icon: "calendar",
          active: state.period !== "mes",
        },
        {
          key: "tipo",
          label: "Tipo",
          value: { todos: "Todos", receita: "Receita", despesa: "Despesa" }[state.type],
          icon:
            state.type === "receita"
              ? "trending"
              : state.type === "despesa"
              ? "trending-down"
              : "filter",
          color:
            state.type === "receita" ? "#059669" : state.type === "despesa" ? "#DC2626" : null,
          active: state.type !== "todos",
        },
        {
          key: "forma",
          label: "Forma de pagamento",
          value: getPaymentMethodLabel(state.method),
          icon: "wallet",
          active: state.method.length > 0,
          multi: state.method.length,
        },
        {
          key: "categoria",
          label: "Categoria",
          value:
            state.cats.length === 0
              ? "Todas"
              : state.cats.length === 1
              ? categoriesById[state.cats[0]]?.label || state.cats[0]
              : `${state.cats.length} categorias`,
          icon: "circle",
          active: state.cats.length > 0,
          multi: state.cats.length,
        },
        {
          key: "tag",
          label: "Tags",
          value:
            state.tags.length === 0
              ? "—"
              : state.tags.length === 1
              ? `#${state.tags[0]}`
              : `${state.tags.length} tags`,
          icon: "tag",
          active: state.tags.length > 0,
          multi: state.tags.length,
        },
        {
          key: "cartao",
          label: "Cartão",
          value:
            state.cardSel.length === 0
              ? "Todos"
              : state.cardSel.length === 1
              ? cardsById[state.cardSel[0]]?.label || state.cardSel[0]
              : `${state.cardSel.length} cartões`,
          icon: "card",
          active: state.cardSel.length > 0,
          multi: state.cardSel.length,
        },
        {
          key: "valor",
          label: "Valor",
          value: rangeLabel(state.valueMin, state.valueMax),
          icon: "wallet",
          active: Boolean(state.valueMin || state.valueMax),
        },
        {
          key: "recorrencia",
          label: "Recorrência",
          value: { any: "Todas", yes: "Apenas rec.", no: "Únicas" }[state.rec],
          icon: "repeat",
          active: state.rec !== "any",
        },
      ];
    },
    [state],
  );

  /** Ordena uma lista in-memory aplicando o sort atual. */
  const sortItems = useCallback((arr) => sortItemsFn(arr, sort), [sort]);

  const hasAnyActive = useMemo(() => {
    if (state.period !== DEFAULT_FILTER_STATE.period) return true;
    if (state.type !== DEFAULT_FILTER_STATE.type) return true;
    if (state.method.length) return true;
    if (state.cats.length) return true;
    if (state.tags.length) return true;
    if (state.cardSel.length) return true;
    if (state.rec !== DEFAULT_FILTER_STATE.rec) return true;
    if (state.valueMin || state.valueMax) return true;
    if (state.search) return true;
    return false;
  }, [state]);

  return {
    // estado
    ...state,
    sort,
    snapshot,
    // setters de campo
    setSearch: (v) => setField("search", v),
    setPeriod: (v) => setField("period", v),
    setCustomFrom: (v) => setField("customFrom", v),
    setCustomTo: (v) => setField("customTo", v),
    setType,
    setMethod: (v) => setField("method", v),
    setCats: (v) => setField("cats", v),
    setTags: (v) => setField("tags", v),
    setCardSel: (v) => setField("cardSel", v),
    setRec: (v) => setField("rec", v),
    setValueMin: (v) => setField("valueMin", v),
    setValueMax: (v) => setField("valueMax", v),
    setSort,
    setField,
    // bulk
    applySnapshot,
    clearAll,
    // derivados
    buildFacets,
    sortItems,
    hasAnyActive,
  };
}

function rangeLabel(min, max) {
  if (!min && !max) return "Qualquer";
  if (min && max) return `R$ ${min} – ${max}`;
  if (min) return `≥ R$ ${min}`;
  return `≤ R$ ${max}`;
}
