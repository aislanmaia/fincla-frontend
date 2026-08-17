import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * Facet "Situação" — eixo de liquidação.
 *
 * "A pagar" é o que responde a pergunta que o usuário não conseguia fazer: *quais
 * lançamentos ainda não entraram no saldo da minha conta?* O backend só soma
 * `status='paid'` no saldo, então um compromisso pendente é invisível ali.
 */
const OPTIONS = [
  { v: "todas", l: "Todas", hint: "Sem filtro", icon: "filter" },
  {
    v: "pagas",
    l: "Pagas",
    hint: "Já entraram no saldo",
    icon: "check",
    color: T.green,
  },
  {
    v: "a-pagar",
    l: "A pagar",
    hint: "Ainda fora do saldo",
    icon: "circle",
    color: T.amber,
  },
];

export function SettlementPanel({ settlement, setSettlement, onClose, onApply, compact = false }) {
  const select = (value) => {
    setSettlement(value);
    if (typeof onApply === "function") onApply();
  };

  return (
    <div>
      <PanelHeader
        title="Situação"
        hint="Pago = já saiu/entrou na conta. A pagar = compromisso que ainda não mexeu no saldo."
        onClose={onClose}
        compact={compact}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr",
          gap: 10,
        }}
      >
        {OPTIONS.map((o) => {
          const active = settlement === o.v;
          const col = o.color || T.ink;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => select(o.v)}
              aria-pressed={active}
              aria-label={o.l}
              style={{
                ...G,
                display: "flex",
                flexDirection: compact ? "row" : "column",
                alignItems: compact ? "center" : "flex-start",
                gap: compact ? 10 : 8,
                padding: "14px 14px",
                borderRadius: 12,
                border: `1.5px solid ${active ? col : T.border}`,
                background: active ? `${col}08` : T.surface,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: active ? col : `${col}15`,
                  color: active ? "#fff" : col,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={o.icon} size={13} color={active ? "#fff" : col} />
              </div>
              <div>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{o.l}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{o.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
