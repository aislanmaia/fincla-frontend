import React, { useEffect, useMemo, useState } from "react";
import { T } from "../../../tokens";
import { FacetBar } from "./facetBar/FacetBar.jsx";
import { FacetPanelContent } from "./facetBar/FacetPanelContent.jsx";
import { SavedViewsCards } from "./savedViews/SavedViewsCards.jsx";
import { SearchBar } from "./search/SearchBar.jsx";
import { Icon } from "./shared/Icon.jsx";

/**
 * Componente raiz da Variação C — Faceted Pills.
 *
 * Composição (de cima pra baixo):
 *   1. SavedViewsCards (opcional via `showSavedViews`)
 *   2. SearchBar  (search + SortButton multi-nível)
 *   3. FacetBar   (7 facets como cards)
 *   4. Painel inline da facet expandida (empurra conteúdo abaixo)
 *
 * Controlado: o estado vive no `useTransactionsFilterState` no consumidor.
 *
 * Props principais:
 *  - filter:        retorno de `useTransactionsFilterState`
 *  - categories:    [{ id, label, color, icon }]
 *  - cards:         [{ id, label, last4, color }]
 *  - allTags:       string[]
 *  - savedViews:    { items, active, onActivate, onCreate, onDelete }
 *  - searchInput / setSearchInput: opcional, para quando a página debounce a busca fora.
 */
export function TransactionsFilterBar({
  filter,
  categories = [],
  cards = [],
  allTags = [],
  savedViews,
  searchInput,
  setSearchInput,
  hideSearch = false,
  /** Callback opcional executado ao limpar tudo, antes de `filter.clearAll()`.
   *  Útil para o consumidor zerar estado externo (search debounced, paginação). */
  onClearAll,
}) {
  const [expanded, setExpanded] = useState(null);

  // Fecha o painel inline quando troca de saved view ativa
  useEffect(() => {
    setExpanded(null);
  }, [savedViews?.active]);

  // Fecha o painel com Esc global
  useEffect(() => {
    if (!expanded) return;
    const onEsc = (e) => {
      if (e.key === "Escape") setExpanded(null);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [expanded]);

  const categoriesById = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const cardsById = useMemo(() => {
    const map = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

  const facets = filter.buildFacets({ categoriesById, cardsById });

  const activeFacets = facets
    .filter((f) => f.active)
    .map((f) => ({
      label: f.label,
      value: f.value,
      icon: f.icon,
      color: f.color || T.ink,
    }));

  const handleToggle = (key) => setExpanded((prev) => (prev === key ? null : key));

  // Para SearchBar: se o consumidor passou search/setSearch externos (caso de debounce),
  // usar; senão cair no `filter.search` controlado pelo hook interno.
  const search = searchInput !== undefined ? searchInput : filter.search;
  const setSearch =
    setSearchInput !== undefined
      ? setSearchInput
      : (v) => filter.setSearch(v);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      onClick={() => {
        // click fora dos popovers fecha o painel inline
        // (popovers param propagação no click interno)
      }}
    >
      {savedViews && (
        <SavedViewsCards
          items={savedViews.items}
          active={savedViews.active}
          onActivate={savedViews.onActivate}
          onDelete={savedViews.onDelete}
          onCreate={savedViews.onCreate}
          activeFacets={activeFacets}
        />
      )}

      {!hideSearch && (
        <SearchBar
          search={search}
          setSearch={setSearch}
          sort={filter.sort}
          setSort={filter.setSort}
        />
      )}

      <FacetBar
        facets={facets}
        expanded={expanded}
        onToggle={handleToggle}
        onClearAll={() => {
          if (typeof onClearAll === "function") onClearAll();
          filter.clearAll();
          setExpanded(null);
        }}
        hasAnyActive={filter.hasAnyActive}
      />

      {expanded && (
        <div
          id={`facet-panel-${expanded}`}
          role="region"
          aria-label={`Filtro: ${expanded}`}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "18px 22px",
            boxShadow: T.md,
            animation: "fadeInDown 0.18s ease",
          }}
        >
          <FacetPanelContent
            facetKey={expanded}
            // period
            period={filter.period}
            setPeriod={filter.setPeriod}
            customFrom={filter.customFrom}
            setCustomFrom={filter.setCustomFrom}
            customTo={filter.customTo}
            setCustomTo={filter.setCustomTo}
            // type
            type={filter.type}
            setType={filter.setType}
            // category
            cats={filter.cats}
            setCats={filter.setCats}
            categories={categories}
            // tag
            tags={filter.tags}
            setTags={filter.setTags}
            allTags={allTags}
            // card
            cardSel={filter.cardSel}
            setCardSel={filter.setCardSel}
            cards={cards}
            // value
            valueMin={filter.valueMin}
            valueMax={filter.valueMax}
            setValueMin={filter.setValueMin}
            setValueMax={filter.setValueMax}
            // rec
            rec={filter.rec}
            setRec={filter.setRec}
            // chrome
            onClose={() => setExpanded(null)}
            compact={false}
          />
        </div>
      )}
    </div>
  );
}

// Re-export para callers que querem o ícone consistente com o resto da feature
export { Icon };
