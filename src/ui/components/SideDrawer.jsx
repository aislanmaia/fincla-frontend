import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useFocusTrap } from "../features/transactions/useFocusTrap.js";
import { T } from "../tokens";
import { G } from "../typography";

/**
 * Painel lateral à direita, sobre a tela, sem tirar a pessoa dela.
 *
 * PORTALIZADO no `body`: um ancestral com `transform` (animação de entrada das telas) viraria o bloco de contenção
 * do `position: fixed` e prenderia o painel dentro do card. Foco preso enquanto aberto (e devolvido ao gatilho ao
 * fechar), Esc, ✕ e o fundo fecham. O corpo rola por dentro; o rodapé fica fixo embaixo.
 *
 * `fullScreen` ocupa a tela inteira (celular). Quem decide o limite é quem usa: o painel de exportação usa 700 px.
 */
export function SideDrawer({
  title,
  ariaLabel = title,
  onClose,
  width = 820,
  fullScreen = false,
  footer = null,
  closeLabel = "Fechar",
  testId = "side-drawer",
  children,
}) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return createPortal(
    <div
      data-testid={`${testId}-backdrop`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,15,13,.35)",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "stretch",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
        style={{
          ...G,
          background: T.surface,
          width: fullScreen ? "100%" : `min(100%, ${width}px)`,
          height: "100%",
          boxSizing: "border-box",
          boxShadow: T.lg,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <h2 style={{ ...G, margin: 0, fontSize: 16, fontWeight: 700, color: T.ink }}>{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            style={{ border: 0, background: "none", cursor: "pointer", color: T.inkMid, display: "flex", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="fincla-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
