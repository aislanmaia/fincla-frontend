import React, { useEffect, useMemo, useRef, useState } from "react";
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
 *   1. SavedViewsCards (opcional via `savedViews`)
 *   2. SearchBar  (search + SortButton multi-nível) — modo compact stackeia
 *   3. FacetBar   (7 facets como cards) — modo compact = grid 2 colunas
 *   4. Painel inline da facet expandida (empurra conteúdo abaixo)
 *
 * Modo `compact`:
 *   - Saved views stackeiam verticalmente
 *   - Search e Sort stackeiam (ou só Sort se hideSearch)
 *   - FacetBar em grid 2 colunas com touch targets ≥ 56px
 *   - Painéis com grid single-column
 *   - Popovers viram inline-stacked (sem absolute)
 *   - Ao expandir um facet, scroll suave faz o painel entrar em view
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
 *  - hideSearch: oculta a SearchBar (útil quando o consumidor já mostra o input fora).
 *  - compact: modo mobile — vertical stack, touch targets, popovers inline.
 *  - onClearAll: callback executado antes do `filter.clearAll()`.
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
  compact = false,
  onClearAll,
}) {
  const [expanded, setExpanded] = useState(null);
  const panelRef = useRef(null);

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

  // Quando um painel é expandido, faz scroll suave para ele entrar em view.
  // Importante no mobile (dentro do bottom sheet) e também em viewports
  // pequenos no desktop. Aguarda o próximo frame para o nó renderizar.
  useEffect(() => {
    if (!expanded) return;
    const id = window.requestAnimationFrame(() => {
      const el = panelRef.current;
      if (el && typeof el.scrollIntoView === "function") {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        } catch {
          el.scrollIntoView();
        }
      }
    });
    return () => window.cancelAnimationFrame(id);
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
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 14 : 12 }}>
      {savedViews && (
        <SavedViewsCards
          items={savedViews.items}
          active={savedViews.active}
          onActivate={savedViews.onActivate}
          onDelete={savedViews.onDelete}
          onCreate={savedViews.onCreate}
          activeFacets={activeFacets}
          compact={compact}
        />
      )}

      {!hideSearch && (
        <SearchBar
          search={search}
          setSearch={setSearch}
          sort={filter.sort}
          setSort={filter.setSort}
          compact={compact}
        />
      )}

      {/* Quando hideSearch=true (mobile: search externa ao sheet) ainda
          precisamos do controle de ordenação dentro do sheet, então
          renderizamos um SearchBar compacto só com o SortButton. */}
      {hideSearch && compact && (
        <SearchBar
          search={search}
          setSearch={setSearch}
          sort={filter.sort}
          setSort={filter.setSort}
          compact
          hideSearchField
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
        compact={compact}
      />

      {expanded && (
        <div
          ref={panelRef}
          id={`facet-panel-${expanded}`}
          role="region"
          aria-label={`Filtro: ${expanded}`}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: compact ? "14px 14px 16px" : "18px 22px",
            boxShadow: T.md,
            animation: "fadeInDown 0.18s ease",
            scrollMarginTop: compact ? 12 : 24,
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
            compact={compact}
          />
        </div>
      )}
    </div>
  );
}

// Re-export para callers que querem o ícone consistente com o resto da feature
export { Icon };
