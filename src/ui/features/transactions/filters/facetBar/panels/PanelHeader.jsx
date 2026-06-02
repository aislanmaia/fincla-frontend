import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";

export function PanelHeader({ title, hint, onClose }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <div>
        <div
          style={{
            ...G,
            fontSize: 15,
            fontWeight: 800,
            color: T.ink,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {hint && (
          <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2 }}>{hint}</div>
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
          padding: 6,
          display: "flex",
        }}
      >
        <Icon name="x" size={14} color={T.inkMid} />
      </button>
    </div>
  );
}
