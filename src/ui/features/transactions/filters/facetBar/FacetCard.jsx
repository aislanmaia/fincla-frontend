import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { CountChip } from "../shared/CountChip.jsx";

/**
 * Card individual da FacetBar (modo "cards"). Mostra label uppercase, valor formatado,
 * ícone (com cor de status quando aplicável) e badge "+N" para multi-seleção.
 *
 * Props:
 *  - facet: { key, label, value, icon, color, active, multi }
 *  - expanded: boolean
 *  - onClick(): toggle do painel inline
 */
export function FacetCard({ facet, expanded, onClick }) {
  const { key, label, value, icon, color, active, multi } = facet;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={expanded}
      aria-controls={`facet-panel-${key}`}
      aria-label={`${label}: ${value}`}
      style={{
        ...G,
        flex: "1 1 130px",
        minWidth: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "8px 12px",
        borderRadius: 9,
        border: "none",
        background: expanded ? T.bg : "transparent",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name={icon} size={10} color={active ? color || T.ink : T.inkLight} />
        <span
          style={{
            ...G,
            fontSize: 10,
            fontWeight: 700,
            color: T.inkMid,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {multi > 1 && <CountChip n={multi} dark />}
      </div>
      <div
        style={{
          ...G,
          fontSize: 13,
          fontWeight: active ? 700 : 500,
          color: active ? color || T.ink : T.inkLight,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {value}
      </div>
    </button>
  );
}
