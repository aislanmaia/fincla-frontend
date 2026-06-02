import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { FacetCard } from "./FacetCard.jsx";

/**
 * Barra horizontal de facets (modo "cards"). Estado `expanded` indica qual
 * facet está aberta — apenas uma por vez. Painel é renderizado fora da barra,
 * inline abaixo dela (responsabilidade do componente pai).
 */
export function FacetBar({ facets, expanded, onToggle, onClearAll, hasAnyActive = false }) {
  return (
    <div
      role="toolbar"
      aria-label="Filtros de transações"
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        alignItems: "stretch",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: T.sm,
        position: "relative",
        flexWrap: "wrap",
      }}
    >
      {facets.map((f) => (
        <FacetCard
          key={f.key}
          facet={f}
          expanded={expanded === f.key}
          onClick={() => onToggle(f.key)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onClearAll}
        disabled={!hasAnyActive}
        aria-label="Limpar todos os filtros"
        style={{
          ...G,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "0 12px",
          borderRadius: 9,
          border: "none",
          background: "transparent",
          fontSize: 11.5,
          fontWeight: 700,
          color: hasAnyActive ? T.red : T.inkGhost,
          cursor: hasAnyActive ? "pointer" : "not-allowed",
          opacity: hasAnyActive ? 1 : 0.6,
        }}
      >
        Limpar tudo
      </button>
    </div>
  );
}
