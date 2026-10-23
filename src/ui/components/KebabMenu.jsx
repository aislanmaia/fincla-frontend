import React from "react";
import { createPortal } from "react-dom";

import { T } from "../tokens";
import { G } from "../typography";

const itemStyle = {
  ...G,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 500,
  padding: "9px 13px",
  border: "none",
  background: "transparent",
};

/**
 * Menu "⋮" (kebab) genérico renderizado em **portal** (não clipa dentro de um Card
 * ou de uma tabela com `overflow`). Fecha em: seleção de item ativo, **clique fora**,
 * **Escape**, **scroll** ou **resize**. A posição é capturada na abertura (não
 * reposiciona), então fechar no scroll evita o menu descolar do gatilho.
 *
 * `items`: `[{ key, label, badge?, disabled?, onSelect?, testId? }]`; `triggerStyle` troca o visual do gatilho (ex.: botão de barra de topo) — ids/handlers no chamador,
 * labels PT-BR. Consolida o padrão portal-dropdown antes hand-rolled em telas soltas
 * (AccountsPage/CalendarPage); migrar esses call-sites pro primitivo é follow-up.
 */
export function KebabMenu({ ariaLabel = "Ações", items = [], width = 190, triggerStyle, triggerTestId, triggerDot = false }) {
  const [rect, setRect] = React.useState(null);
  const menuRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const open = rect != null;

  const close = React.useCallback(() => setRect(null), []);
  const toggle = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRect((prev) => (prev ? null : r));
  };

  React.useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      // clique no gatilho é tratado pelo próprio toggle; ignore-o aqui
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => close();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, close]);

  const select = (item) => {
    if (item.disabled) return;
    close();
    item.onSelect?.();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={triggerTestId}
        style={{ border: "none", background: "none", cursor: "pointer", color: T.inkGhost, fontSize: 18, lineHeight: 1, padding: 4, position: "relative", ...triggerStyle }}
      >
        ⋮
        {triggerDot && (
          <span data-testid="kebab-dot" aria-hidden="true"
            style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 9999, background: T.blue, border: `1.5px solid ${T.surface}` }} />
        )}
      </button>

      {open
        ? createPortal(
            (() => {
              const menuHeight = items.length * 38 + 2; // rows are ~38px; the menu clips, so it must fit where it opens
              const flipUp = rect.bottom + menuHeight + 8 > window.innerHeight;
              const top = flipUp ? rect.top - 4 : rect.bottom + 4;
              const left = Math.max(8, rect.right - width);
              return (
                <div
                  ref={menuRef}
                  role="menu"
                  style={{
                    position: "fixed",
                    left,
                    top,
                    transform: flipUp ? "translateY(-100%)" : "none",
                    width,
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    boxShadow: T.lg,
                    zIndex: 150,
                    overflow: "hidden",
                  }}
                >
                  {items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      data-testid={item.testId}
                      disabled={item.disabled}
                      onClick={() => select(item)}
                      style={{ ...itemStyle, color: item.disabled ? T.inkFaint : T.inkMid, cursor: item.disabled ? "default" : "pointer" }}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })(),
            document.body,
          )
        : null}
    </>
  );
}
