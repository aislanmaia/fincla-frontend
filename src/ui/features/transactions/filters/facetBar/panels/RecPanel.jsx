import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

const OPTIONS = [
  { v: "any", l: "Todas", hint: "Sem filtro", icon: "filter" },
  {
    v: "yes",
    l: "Apenas recorrentes",
    hint: "Repetem todo período",
    icon: "repeat",
    color: T.blue,
  },
  { v: "no", l: "Apenas únicas", hint: "Lançamento isolado", icon: "circle" },
];

export function RecPanel({ rec, setRec, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader
        title="Recorrência"
        hint="Lançamentos que se repetem (assinaturas, salário, aluguel…)"
        onClose={onClose}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr",
          gap: 10,
        }}
      >
        {OPTIONS.map((o) => {
          const active = rec === o.v;
          const col = o.color || T.ink;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => setRec(o.v)}
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
