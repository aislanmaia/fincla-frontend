import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { SortButton } from "./SortButton.jsx";

/**
 * Barra de busca + botão de ordenação. Componente controlado:
 *  - `search` / `setSearch`: texto da busca (já debounced fora se necessário).
 *  - `sort` / `setSort`: array de regras de ordenação multi-nível.
 */
export function SearchBar({
  search,
  setSearch,
  sort,
  setSort,
  placeholder = "Buscar por descrição, valor, tag…",
}) {
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
