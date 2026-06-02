import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { SORT_FIELDS } from "./sortModel.js";

/**
 * Tooltip preto mostrado no hover do botão de ordenação (somente quando o menu
 * está fechado). `pointer-events: none` para não roubar foco do botão.
 */
export function SortTooltip({ rules }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: T.ink,
        color: "#fff",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: T.lg,
        zIndex: 75,
        pointerEvents: "none",
        minWidth: 200,
        maxWidth: 280,
        animation: "fadeInDown 0.12s ease",
      }}
    >
      <div
        style={{
          ...G,
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.55)",
          marginBottom: 6,
        }}
      >
        {rules.length === 1 ? "Ordenando por" : `Ordenando por ${rules.length} critérios`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rules.map((rule, i) => {
          const f = SORT_FIELDS[rule.field];
          if (!f) return null;
          return (
            <div key={rule.field} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  ...G,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <Icon name={f.icon} size={11} color="rgba(255,255,255,0.7)" />
              <span style={{ ...G, fontSize: 11.5, fontWeight: 600, color: "#fff" }}>{f.label}</span>
              <span style={{ ...G, fontSize: 11, color: "rgba(255,255,255,0.7)", flex: 1 }}>
                · {f.dirLabels[rule.dir]}
              </span>
              <span style={{ fontWeight: 800, color: "#fff", fontSize: 12 }}>
                {rule.dir === "asc" ? "↑" : "↓"}
              </span>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -4,
          right: 14,
          width: 8,
          height: 8,
          background: T.ink,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}
