import React from "react";

import { T } from "../../tokens";
import { Icon } from "./consultantUi";

/**
 * Ações inline de um cliente da carteira (RF.6, fiel à referência
 * `cons-clientes.jsx`): "Avaliar com IA" + "Mensagem" (**Trilha B → stubs
 * desabilitados "em breve"**) e, opcionalmente, "Abrir" (seta). O wrapper para a
 * propagação para não disparar o clique de abrir do card/linha ao interagir aqui.
 */
export function ConsultantClientActions({ onOpen, showOpen = false, radius = 8, pad = "7px 9px" }) {
  const neutral = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius, padding: pad, display: "flex" };
  return (
    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" disabled title="Avaliar com IA (em breve)" style={{ ...neutral, background: T.purpleLight, border: "none", cursor: "default", opacity: 0.6 }}>
        <Icon name="sparkles" size={13} color={T.purple} />
      </button>
      <button type="button" disabled title="Mensagem (em breve)" style={{ ...neutral, cursor: "default", opacity: 0.6 }}>
        <Icon name="message" size={13} color={T.inkMid} />
      </button>
      {showOpen && (
        <button type="button" onClick={onOpen} title="Abrir" style={{ ...neutral, cursor: "pointer" }}>
          <Icon name="arrow-right" size={13} color={T.inkMid} />
        </button>
      )}
    </div>
  );
}
