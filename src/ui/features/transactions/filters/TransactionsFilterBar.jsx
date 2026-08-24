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
 *   3. FacetBar   (8 facets como cards) — modo compact = grid 2 colunas
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
 *  - allTagsLoading: catálogo de tags ainda carregando (mostra "Carregando…" em vez de "Nenhuma tag cadastrada")
 *  - allTagsError:   catálogo falhou ao carregar (mensagem de erro própria; painel não oferece opções nesse estado)
 *  - savedViews:    { items, active, onActivate, onCreate, onDelete }
 *  - searchInput / setSearchInput: opcional, para quando a página debounce a busca fora.
 *  - hideSearch: oculta a SearchBar (útil quando o consumidor já mostra o input fora).
 *  - compact: modo mobile — vertical stack, touch targets, popovers inline.
 *  - onClearAll: callback executado antes do `filter.clearAll()`.
 *  - filteredCount: total de transações visíveis (CTA "Ver N transações").
 *  - resultsLoading: desabilita CTA enquanto a lista recarrega (ex.: debounce busca).
 *  - onAfterApply: callback após dismiss (ex.: scroll suave para a lista).
 *  - facetCounts: retorno de `useTransactionsFacetCounts` — números por opção
 *    dentro dos painéis. Opcional: sem ele os painéis só não mostram contagem.
 *  - onExpandedChange: avisa qual facet está aberta (`null` = nenhuma). É o que
 *    permite ao consumidor só pagar a busca de contagens com o painel aberto.
 *  - requestOpenFacet: `{ key, nonce }` — pedido externo de abrir uma facet
 *    (clique num chip de filtro ativo). O `nonce` existe porque pedir a MESMA
 *    facet duas vezes seguidas precisa reabrir; sem ele o efeito não dispara.
 */
export function TransactionsFilterBar({
  /* Repassa para a página o orçamento que a barra mediu — é ela que monta os
     chips e portanto quem precisa do número. */
  onChipsBudget = null,
  searchInputRef = null,
  onHelp = null,
  filter,
  categories = [],
  cards = [],
  allTags = [],
  allTagsLoading = false,
  allTagsError = false,
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
  facetCounts,
  onExpandedChange,
  requestOpenFacet,
  barLeading = null,
  barChips = null,
  barTrailing = null,
}) {
  const [expanded, setExpanded] = useState(null);
  const panelRef = useRef(null);

  const dismissPanel = useCallback(() => {
    setExpanded(null);
    if (typeof onAfterApply === "function") onAfterApply();
  }, [onAfterApply]);

  // As duas notificações abaixo são inertes quando `hideFacets` está ligado.
  // No desktop compacto existem DUAS instâncias desta barra ao mesmo tempo (uma
  // só com a busca, outra só com as facets); a que esconde as facets não
  // renderiza painel nenhum, então deixá-la aceitar um pedido de abrir só
  // armaria o Esc global dela sobre um painel que não existe — e o Esc do
  // usuário rolaria a lista sem nada ter fechado.
  useEffect(() => {
    if (hideFacets) return;
    if (typeof onExpandedChange === "function") onExpandedChange(expanded);
  }, [expanded, onExpandedChange, hideFacets]);

  useEffect(() => {
    if (hideFacets || !requestOpenFacet?.key) return;
    setExpanded(requestOpenFacet.key);
    // Depende do `nonce`, não da `key`: pedir a mesma facet de novo (fechar e
    // clicar no mesmo chip) precisa reabrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestOpenFacet?.nonce, hideFacets]);

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
          leading={barLeading}
          chips={barChips}
          trailing={barTrailing}
          onChipsBudget={onChipsBudget}
          inputRef={searchInputRef}
          onHelp={onHelp}
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
        /* `position: relative` só para ancorar o painel. No mobile ele continua
           inline, dentro do bottom sheet, que já tem rolagem própria. */
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
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
              className={compact ? undefined : "fincla-scroll"}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: compact ? "14px 14px 16px" : "18px 22px",
                boxShadow: compact ? T.md : T.xl,
                animation: "fadeInDown 0.18s ease",
                scrollMarginTop: compact ? 12 : 24,
                /* No desktop o painel FLUTUA sobre a lista em vez de empurrá-la.
                   Medido antes: abrir uma faceta em 1366×768 crescia o bloco de
                   filtros de 232 para 670 px, empurrava os KPIs para fora da
                   dobra e deixava a lista com altura ZERO — a página inteira
                   passava a rolar e o título saía do topo. */
                ...(compact
                  ? null
                  : {
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 8,
                      zIndex: 40,
                      maxHeight: "min(60dvh, 520px)",
                      overflowY: "auto",
                    }),
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
                // payment method
                method={filter.method}
                setMethod={filter.setMethod}
                // category
                cats={filter.cats}
                setCats={filter.setCats}
                categories={categories}
                // tag
                tags={filter.tags}
                setTags={filter.setTags}
                tagMode={filter.tagMode}
                setTagMode={filter.setTagMode}
                allTags={allTags}
                allTagsLoading={allTagsLoading}
                allTagsError={allTagsError}
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
                // situação (liquidação)
                settlement={filter.settlement}
                setSettlement={filter.setSettlement}
                counts={facetCounts}
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
        </div>
      )}
    </div>
  );
}

// Re-export para callers que querem o ícone consistente com o resto da feature
export { Icon };
