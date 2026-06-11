import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "../../../tokens";
import { FacetBar } from "./facetBar/FacetBar.jsx";
import { FacetPanelContent } from "./facetBar/FacetPanelContent.jsx";
import { SavedViewsCards } from "./savedViews/SavedViewsCards.jsx";
import { SearchBar } from "./search/SearchBar.jsx";
import { FacetApplyFooter } from "./shared/FacetApplyFooter.jsx";
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
 *  - filteredCount: total de transações visíveis (CTA "Ver N transações").
 *  - resultsLoading: desabilita CTA enquanto a lista recarrega (ex.: debounce busca).
 *  - onAfterApply: callback após dismiss (ex.: scroll suave para a lista).
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
  filteredCount = 0,
  resultsLoading = false,
  onAfterApply,
  hideSavedViews = false,
  hideFacets = false,
  onSaveViewCreate,
  onSaveViewUpdate,
  saveViewUpdateLabel = "",
  filterToolbarActive,
}) {
  const [expanded, setExpanded] = useState(null);
  const panelRef = useRef(null);

  const dismissPanel = useCallback(() => {
    setExpanded(null);
    if (typeof onAfterApply === "function") onAfterApply();
  }, [onAfterApply]);

  // Fecha o painel inline quando troca de saved view ativa
  useEffect(() => {
    setExpanded(null);
  }, [savedViews?.active]);

  // Fecha o painel com Esc global (mantém filtros já aplicados)
  useEffect(() => {
    if (!expanded) return;
    const onEsc = (e) => {
      if (e.key === "Escape") dismissPanel();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [expanded, dismissPanel]);

  // Enter dentro do painel aplica (dismiss) — espelha o CTA "Ver N transações"
  useEffect(() => {
    if (!expanded) return;
    const onEnter = (e) => {
      if (e.key !== "Enter") return;
      const panel = panelRef.current;
      if (!panel) return;
      const target = e.target;
      if (!(target instanceof Node) || !panel.contains(target)) return;
      if (target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      dismissPanel();
    };
    document.addEventListener("keydown", onEnter);
    return () => document.removeEventListener("keydown", onEnter);
  }, [expanded, dismissPanel]);

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
      {savedViews && !hideSavedViews && (
        <SavedViewsCards
          items={savedViews.items}
          active={savedViews.active}
          onActivate={savedViews.onActivate}
          onDelete={savedViews.onDelete}
          onOpenSaveForm={savedViews.onOpenSaveForm ?? (() => {})}
          onSaveView={
            savedViews.onSaveView ??
            ((draft) => {
              if (savedViews.onCreate) {
                savedViews.onCreate(draft);
              }
            })
          }
          activeFacets={activeFacets}
          compact={compact}
          saveFormMode={savedViews.saveFormMode ?? "create"}
          saveFormInitialName={savedViews.saveFormInitialName ?? ""}
          saveFormInitialIcon={savedViews.saveFormInitialIcon ?? "bookmark"}
          saveFormInitialColor={savedViews.saveFormInitialColor}
          updateViewLabel={savedViews.updateViewLabel ?? ""}
          newFormOpen={savedViews.newFormOpen}
          onNewFormOpenChange={savedViews.onNewFormOpenChange}
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

      {!hideFacets && (
        <>
          <FacetBar
            facets={facets}
            expanded={expanded}
            onToggle={handleToggle}
            onClearAll={() => {
              if (typeof onClearAll === "function") onClearAll();
              filter.clearAll();
              setExpanded(null);
            }}
            onSaveViewCreate={onSaveViewCreate}
            onSaveViewUpdate={onSaveViewUpdate}
            saveViewUpdateLabel={saveViewUpdateLabel}
            hasAnyActive={filterToolbarActive ?? filter.hasAnyActive}
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
                onClose={dismissPanel}
                onApply={dismissPanel}
                compact={compact}
              />
              {!compact && (
                <FacetApplyFooter
                  count={filteredCount}
                  onApply={dismissPanel}
                  loading={resultsLoading}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Re-export para callers que querem o ícone consistente com o resto da feature
export { Icon };
