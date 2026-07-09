import React from "react";

import { T } from "../../tokens";
import { Icon } from "./consultantUi";

/**
 * Ações inline de um cliente da carteira (RF.6, fiel à referência
 * `cons-clientes.jsx`): "Avaliar com IA" + "Mensagem" e, opcionalmente, "Abrir"
 * (seta). "Avaliar com IA" está ativo desde a entrega A1 do Consultor IA;
 * "Mensagem" segue **stub desabilitado "em breve"** (Trilha B / Frente B).
 * O wrapper para a propagação para não disparar o clique de abrir do card/linha
 * ao interagir aqui.
 *
 * `onEvaluate` ausente mantém o botão de IA desabilitado — assim uma superfície
 * que ainda não montou o drawer não oferece uma ação que não funciona.
 */
export function ConsultantClientActions({ onOpen, onEvaluate, showOpen = false, pending = false, onRegenerate, radius = 8, pad = "7px 9px" }) {
  const neutral = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius, padding: pad, display: "flex" };
  const canEvaluate = typeof onEvaluate === "function";
  return (
    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
      {pending && (
        <button type="button" onClick={onRegenerate} title="Cliente ainda não definiu a senha — gerar novo link"
          style={{ ...neutral, background: T.amberLight, border: `1px solid ${T.amberBorder}`, cursor: "pointer" }}>
          <Icon name="clock" size={13} color={T.amber} />
        </button>
      )}
      <button type="button" onClick={onEvaluate} disabled={!canEvaluate}
        title={canEvaluate ? "Avaliar com IA" : "Avaliar com IA (em breve)"}
        style={{ ...neutral, background: T.purpleLight, border: "none", cursor: canEvaluate ? "pointer" : "default", opacity: canEvaluate ? 1 : 0.6 }}>
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
