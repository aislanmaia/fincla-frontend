import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";

/**
 * Botão "×" hover-revealed em cada saved view + popover de confirmação.
 *
 * Visibilidade controlada por CSS (`.delete-view-btn` opacity 0 → 1 quando o
 * pai está em :hover, quando o botão tem `.open` ou recebe foco visível).
 *
 * `variant`:
 *   - "corner" → posição absoluta no canto superior direito (cards)
 *   - "row"    → ícone à direita de uma row (menu)
 *   - "inline" → ícone inline no fim de uma pill (mantido por compatibilidade)
 */
export function DeleteViewControl({ view, onDelete, variant = "corner", cardActive = false, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const cornerStyle = {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 5,
    background: cardActive ? "rgba(255,255,255,0.18)" : T.surface,
    border: `1px solid ${cardActive ? "rgba(255,255,255,0.22)" : T.border}`,
    color: cardActive ? "#fff" : T.inkLight,
  };
  const inlineStyle = {
    width: 16,
    height: 16,
    borderRadius: 99,
    background: "transparent",
    border: "none",
    color: cardActive ? "rgba(255,255,255,0.7)" : T.inkLight,
    marginLeft: 1,
  };
  const rowStyle = {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "transparent",
    border: "none",
    color: T.inkLight,
  };
  const baseStyle = variant === "corner" ? cornerStyle : variant === "inline" ? inlineStyle : rowStyle;

  return (
    <span
      ref={ref}
      style={{
        display: variant === "corner" ? "block" : "inline-flex",
        position: variant === "corner" ? "static" : "relative",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`delete-view-btn delete-view-${variant}${open ? " open" : ""}${compact ? " delete-view-always" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Excluir ${view.label}`}
        title="Excluir visualização"
        style={{
          ...G,
          ...baseStyle,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          transition: "background 0.12s, color 0.12s, opacity 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = cardActive
            ? "rgba(255,255,255,0.25)"
            : T.redLight;
          e.currentTarget.style.color = cardActive ? "#fff" : T.red;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = baseStyle.background;
          e.currentTarget.style.color = baseStyle.color;
        }}
      >
        <Icon name="x" size={variant === "inline" ? 9 : 10} />
      </button>
      {open && (
        <DeleteConfirmPopover
          viewLabel={view.label}
          color={view.color}
          icon={view.icon}
          anchor={variant}
          compact={compact}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            onDelete(view.id);
            setOpen(false);
          }}
        />
      )}
    </span>
  );
}

function DeleteConfirmPopover({ viewLabel, color, icon, anchor, compact = false, onCancel, onConfirm }) {
  // Em "corner": no desktop o card costuma estar próximo da borda esquerda,
  // então o popover abre para a direita (left: -4). No mobile (compact) os
  // cards são full-width e o "x" fica na borda direita: ancoramos pelo
  // `right: -4` para evitar vazar para fora da viewport.
  const posStyle =
    anchor === "corner"
      ? compact
        ? { position: "absolute", top: 28, right: -4 }
        : { position: "absolute", top: 28, left: -4 }
      : anchor === "row"
      ? { position: "absolute", top: "calc(100% + 4px)", right: 0 }
      : { position: "absolute", top: "calc(100% + 6px)", right: -4 };

  return (
    <div
      role="dialog"
      aria-label={`Confirmar exclusão de ${viewLabel}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        ...posStyle,
        width: 240,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: T.lg,
        padding: 12,
        zIndex: 90,
        animation: "fadeInDown 0.14s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `${color}15`,
            color,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={12} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>
            Excluir esta visualização?
          </div>
          <div
            style={{
              ...G,
              fontSize: 11,
              color: T.inkLight,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            “{viewLabel}”
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            ...G,
            flex: 1,
            padding: "7px 10px",
            borderRadius: 7,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.inkMid,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          style={{
            ...G,
            flex: 1,
            padding: "7px 10px",
            borderRadius: 7,
            border: `1px solid ${T.red}`,
            background: T.red,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <Icon name="x" size={10} color="#fff" strokeWidth={2.6} />
          Excluir
        </button>
      </div>
    </div>
  );
}

const DELETE_VIEW_STYLE_ID = "fincla-delete-view-styles";
const DELETE_VIEW_CSS = `
  .delete-view-btn { opacity: 0; pointer-events: none; }
  .saved-view-card:hover .delete-view-corner,
  .saved-view-pill:hover .delete-view-inline,
  .saved-view-row:hover .delete-view-row,
  .delete-view-btn.open,
  .delete-view-btn.delete-view-always,
  .delete-view-btn:focus-visible { opacity: 1; pointer-events: auto; }
`;

/** Injeta uma única vez o CSS de hover-reveal dos botões de delete. */
export function DeleteViewStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(DELETE_VIEW_STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = DELETE_VIEW_STYLE_ID;
    s.textContent = DELETE_VIEW_CSS;
    document.head.appendChild(s);
  }, []);
  return null;
}
