import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";

export function PanelHeader({ title, hint, onClose, compact = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...G,
            fontSize: compact ? 16 : 15,
            fontWeight: 800,
            color: T.ink,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {hint && (
          <div style={{ ...G, fontSize: compact ? 12 : 11.5, color: T.inkLight, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar painel"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: compact ? 10 : 6,
          minWidth: compact ? 40 : undefined,
          minHeight: compact ? 40 : undefined,
          borderRadius: compact ? 10 : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={compact ? 16 : 14} color={T.inkMid} />
      </button>
    </div>
  );
}
