import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";

/**
 * A visualização salva ativa, como chip na barra de comando.
 *
 * No artefato ela é o primeiro item da barra — antes da busca, separada por um
 * fio. Antes disso as views moravam numa faixa própria acima da barra, com
 * cards de ~74 px que existiam mesmo quando não havia view nenhuma salva: a
 * altura era cobrada de todo mundo para um recurso que poucos usam, e ela ficava
 * longe dos filtros que ela na prática guarda.
 *
 * "· alterada" é o estado que mais importa: sem ele o chip afirma que a tela
 * mostra a view salva quando na verdade mostra um recorte por cima dela — e a
 * pessoa salva ou descarta sem saber o que estava vendo.
 */
export function SavedViewsChip({
  items = [],
  active = null,
  dirty = false,
  onActivate,
  onDelete,
  onCreate,
  onUpdate,
  canCreate = false,
  canUpdate = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeItem = items.find((v) => v.id === active) || null;
  const label = activeItem ? activeItem.label : "Visualizações";
  const suffix = activeItem && dirty ? " · alterada" : "";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          activeItem
            ? `Visualização salva: ${label}${suffix}. Trocar.`
            : "Visualizações salvas"
        }
        style={{
          ...G,
          height: 28,
          maxWidth: 190,
          padding: "0 9px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          background: activeItem ? "#F6F2FF" : T.surface,
          border: `1px solid ${activeItem ? "#DDD1FB" : T.border}`,
          color: activeItem ? T.purple : T.inkMid,
        }}
      >
        <Icon name="bookmark" size={11} color={activeItem ? T.purple : T.inkLight} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
          {label}
          {suffix}
        </span>
        <span aria-hidden="true" style={{ opacity: 0.7 }}>
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="fincla-scroll"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 45,
            minWidth: 240,
            maxHeight: "min(60dvh, 380px)",
            overflowY: "auto",
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(15,25,40,.14)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {items.length === 0 && (
            <div style={{ ...G, padding: "10px 10px 12px", fontSize: 11.5, color: T.inkLight }}>
              {canCreate
                ? "Nenhuma visualização salva ainda. Salve o recorte atual para voltar a ele depois."
                : "Nenhuma visualização salva ainda. Aplique um filtro e salve o recorte para voltar a ele depois."}
            </div>
          )}
          {items.map((v) => {
            const isActive = v.id === active;
            return (
              <div
                key={v.id}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onActivate?.(v.id);
                    setOpen(false);
                  }}
                  style={{
                    ...G,
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 9px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "#F6F2FF" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: v.color || T.purple,
                    }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        ...G,
                        display: "block",
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.label}
                      {isActive && dirty ? " · alterada" : ""}
                    </span>
                    {v.hint && (
                      <span style={{ ...G, display: "block", fontSize: 11, color: T.inkLight }}>
                        {v.hint}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(v.id)}
                  aria-label={`Excluir visualização ${v.label}`}
                  title="Excluir"
                  style={{
                    ...G,
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: "none",
                    background: "none",
                    color: T.inkLight,
                    cursor: "pointer",
                    flexShrink: 0,
                    fontSize: 12,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}

          {(canCreate || canUpdate) && (
            <div
              style={{
                display: "flex",
                gap: 6,
                marginTop: 4,
                paddingTop: 6,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              {canUpdate && (
                <MenuAction
                  onClick={() => {
                    onUpdate?.();
                    setOpen(false);
                  }}
                >
                  Atualizar esta
                </MenuAction>
              )}
              {canCreate && (
                <MenuAction
                  onClick={() => {
                    onCreate?.();
                    setOpen(false);
                  }}
                >
                  + Salvar atual
                </MenuAction>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuAction({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...G,
        flex: 1,
        padding: "7px 9px",
        borderRadius: 8,
        border: `1px solid ${T.border}`,
        background: T.surface,
        color: T.inkMid,
        fontSize: 11.5,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
