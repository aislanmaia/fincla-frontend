import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { SortButton } from "./SortButton.jsx";

/**
 * Barra de busca + botão de ordenação.
 *
 * Modo padrão: pílula horizontal com input flexível e SortButton à direita.
 * Modo `compact`: input em uma linha, SortButton em linha separada abaixo
 * (cada um ocupa 100% da largura). Look and feel de app nativo mobile.
 */
export function SearchBar({
  search,
  setSearch,
  sort,
  setSort,
  placeholder = "Buscar por descrição, valor, tag…",
  compact = false,
  hideSearchField = false,
}) {
  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!hideSearchField && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: T.sm,
            }}
          >
            <Icon name="search" size={16} color={T.inkLight} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar transações"
              style={{
                ...G,
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 15,
                color: T.ink,
              }}
            />
          </div>
        )}
        <SortButton sort={sort} setSort={setSort} compact />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "11px 14px",
        boxShadow: T.sm,
      }}
    >
      <Icon name="search" size={15} color={T.inkLight} />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar transações"
        style={{
          ...G,
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          color: T.ink,
        }}
      />
      <SortButton sort={sort} setSort={setSort} />
    </div>
  );
}
