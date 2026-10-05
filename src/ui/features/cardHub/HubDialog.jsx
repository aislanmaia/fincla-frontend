import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Diálogo do Hub: bottom sheet no mobile, janela centralizada no desktop.
 * Mesma casca para anotações, todas as faturas e insights.
 */
export function HubDialog({ title, isMobile, onClose, children, footer = null, width = 460 }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { panelRef.current?.focus(); }, []);

  const inner = (
    <>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
        <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
        <button type="button" onClick={onClose} aria-label="Fechar"
          style={{ background: T.grayLight, border: "none", cursor: "pointer", padding: 7, borderRadius: 8, display: "flex", flexShrink: 0 }}>
          <X size={14} color={T.inkMid} />
        </button>
      </div>
      <div className="fincla-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>{children}</div>
      {footer}
    </>
  );

  const panelProps = { ref: panelRef, role: "dialog", "aria-modal": "true", "aria-label": title, tabIndex: -1 };

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.5)" }} />
        <div {...panelProps} style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column", outline: "none", animation: "sheetUp 0.4s cubic-bezier(0.32,0.72,0,1) both" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: T.inkFaint }} />
          </div>
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.38)" }} />
      <div {...panelProps} style={{ position: "relative", width, maxWidth: "92%", maxHeight: "80dvh", background: T.surface, borderRadius: 18, boxShadow: T.dark, display: "flex", flexDirection: "column", overflow: "hidden", outline: "none" }}>
        {inner}
      </div>
    </div>
  );
}
