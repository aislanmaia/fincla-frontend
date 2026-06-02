import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { CountChip } from "../shared/CountChip.jsx";

/**
 * Card individual da FacetBar. Mostra label uppercase, valor formatado,
 * ícone (com cor de status quando aplicável) e badge "+N" para multi-seleção.
 *
 * Props:
 *  - facet: { key, label, value, icon, color, active, multi }
 *  - expanded: boolean
 *  - compact: boolean (modo mobile, touch targets maiores, mais respiração)
 *  - onClick(): toggle do painel inline
 */
export function FacetCard({ facet, expanded, onClick, compact = false }) {
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
        flex: compact ? undefined : "1 1 130px",
        minWidth: compact ? 0 : 110,
        minHeight: compact ? 60 : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: compact ? 4 : 2,
        padding: compact ? "10px 12px" : "8px 12px",
        borderRadius: compact ? 12 : 9,
        border: compact ? `1px solid ${expanded ? T.ink : T.border}` : "none",
        background: expanded ? (compact ? T.bg : T.bg) : compact ? T.surface : "transparent",
        cursor: "pointer",
        textAlign: "left",
        position: "relative",
        transition: "background 0.15s, border-color 0.15s",
        width: compact ? "100%" : undefined,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <Icon name={icon} size={compact ? 12 : 10} color={active ? color || T.ink : T.inkLight} />
        <span
          style={{
            ...G,
            fontSize: compact ? 10.5 : 10,
            fontWeight: 700,
            color: T.inkMid,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        {multi > 1 && <CountChip n={multi} dark />}
      </div>
      <div
        style={{
          ...G,
          fontSize: compact ? 13.5 : 13,
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
