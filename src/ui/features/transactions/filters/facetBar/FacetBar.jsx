import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { FacetCard } from "./FacetCard.jsx";

/**
 * Barra/grade de facets. Estado `expanded` indica qual facet está aberta —
 * apenas uma por vez. O painel é renderizado fora da barra, inline abaixo
 * (responsabilidade do componente pai).
 *
 * Modo padrão (desktop): flex horizontal com wrap.
 * Modo `compact` (mobile): grid 2 colunas com cards mais altos (touch
 * targets ≥ 56px). Ações ("Limpar tudo") em uma linha própria abaixo.
 */
export function FacetBar({ facets, expanded, onToggle, onClearAll, hasAnyActive = false, compact = false }) {
  if (compact) {
    return (
      <div
        role="toolbar"
        aria-label="Filtros de transações"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 10,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: T.sm,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {facets.map((f) => (
            <FacetCard
              key={f.key}
              facet={f}
              expanded={expanded === f.key}
              onClick={() => onToggle(f.key)}
              compact
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClearAll}
          disabled={!hasAnyActive}
          aria-label="Limpar todos os filtros"
          style={{
            ...G,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "11px 12px",
            borderRadius: 10,
            border: `1px solid ${hasAnyActive ? T.redLight : T.border}`,
            background: hasAnyActive ? T.redLight : "transparent",
            fontSize: 12.5,
            fontWeight: 700,
            color: hasAnyActive ? T.red : T.inkGhost,
            cursor: hasAnyActive ? "pointer" : "not-allowed",
            opacity: hasAnyActive ? 1 : 0.55,
            width: "100%",
          }}
        >
          Limpar tudo
        </button>
      </div>
    );
  }

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
