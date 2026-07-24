import React from "react";
import { T } from "../../tokens";
import { G, S } from "../../typography";

/** Overlay + card centrado (modal no desktop, quase full-width no mobile). */
export function ModalShell({ titleSans, titleSerif, onClose, children, footer }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,15,13,0.28)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: 460,
          maxWidth: "100%",
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          boxShadow: T.lg,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <h2 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ ...G, fontSize: 24, fontWeight: 800, letterSpacing: "-0.025em", color: T.ink }}>{titleSans}</span>
            {titleSerif && <span style={{ ...S, fontSize: 26, color: T.ink }}>{titleSerif}</span>}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ border: "none", background: "none", cursor: "pointer", color: T.inkGhost, fontSize: 18, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "6px 20px 18px", overflowY: "auto" }}>{children}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
