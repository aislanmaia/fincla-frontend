import React from "react";
import { createPortal } from "react-dom";

import { T } from "../../tokens";
import { G } from "../../typography";
import { CLIENT_ROW_ACTIONS, isClientActionEnabled } from "./consultantClientActions";

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
 * Menu de ações da linha de cliente (A2.3): kebab "⋮" que abre um dropdown via
 * portal (não clipa dentro do Card/tabela, espelhando o menu de contas). "Abrir
 * relatório" chama `onOpen(organizationId)` (stub até a rota S3); "Avaliar com IA"
 * e "Enviar mensagem" ficam desabilitadas com selo "em breve" (Trilha B).
 *
 * Presentational + estado local de abertura. Fecha ao clicar no backdrop.
 */
export function ConsultantClientActionsMenu({ organizationId, onOpen, clientName }) {
  const [rect, setRect] = React.useState(null);

  const toggle = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setRect((prev) => (prev ? null : r));
  };
  const close = () => setRect(null);

  const runAction = (action) => {
    if (!isClientActionEnabled(action)) return;
    close();
    if (action.id === "open") onOpen?.(organizationId);
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={rect ? true : false}
        aria-label={clientName ? `Ações de ${clientName}` : "Ações do cliente"}
        style={{ border: "none", background: "none", cursor: "pointer", color: T.inkGhost, fontSize: 18, lineHeight: 1, padding: 4 }}
      >
        ⋮
      </button>

      {rect
        ? createPortal(
            (() => {
              const W = 190;
              const flipUp = rect.bottom + 150 > window.innerHeight;
              const top = flipUp ? rect.top - 4 : rect.bottom + 4;
              const left = Math.max(8, rect.right - W);
              return (
                <>
                  <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 140 }} />
                  <div
                    role="menu"
                    style={{
                      position: "fixed",
                      left,
                      top,
                      transform: flipUp ? "translateY(-100%)" : "none",
                      width: W,
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      boxShadow: T.lg,
                      zIndex: 150,
                      overflow: "hidden",
                    }}
                  >
                    {CLIENT_ROW_ACTIONS.map((action) => {
                      const enabled = isClientActionEnabled(action);
                      return (
                        <button
                          key={action.id}
                          type="button"
                          role="menuitem"
                          disabled={!enabled}
                          onClick={() => runAction(action)}
                          style={{
                            ...itemStyle,
                            color: enabled ? T.inkMid : T.inkGhost,
                            cursor: enabled ? "pointer" : "default",
                          }}
                        >
                          <span>{action.label}</span>
                          {action.soon && (
                            <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              em breve
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })(),
            document.body,
          )
        : null}
    </>
  );
}
