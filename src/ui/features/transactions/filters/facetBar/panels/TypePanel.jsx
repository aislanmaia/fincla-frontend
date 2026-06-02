import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

const OPTIONS = [
  { v: "todos", l: "Todos", hint: "Receitas e despesas", icon: "filter", color: T.ink },
  { v: "receita", l: "Receita", hint: "Entradas no caixa", icon: "trending", color: T.green },
  { v: "despesa", l: "Despesa", hint: "Saídas e gastos", icon: "trending-down", color: T.red },
];

export function TypePanel({ type, setType, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader title="Tipo" onClose={onClose} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr",
          gap: 12,
        }}
      >
        {OPTIONS.map((o) => {
          const active = type === o.v;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => setType(o.v)}
              aria-pressed={active}
              aria-label={o.l}
              style={{
                ...G,
                display: "flex",
                flexDirection: compact ? "row" : "column",
                alignItems: compact ? "center" : "flex-start",
                gap: compact ? 10 : 8,
                padding: compact ? "10px 12px" : "16px 16px",
                borderRadius: 12,
                border: `1.5px solid ${active ? o.color : T.border}`,
                background: active ? `${o.color}08` : T.surface,
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: compact ? 26 : 30,
                  height: compact ? 26 : 30,
                  borderRadius: 8,
                  background: active ? o.color : `${o.color}15`,
                  color: active ? "#fff" : o.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={o.icon} size={compact ? 13 : 15} color={active ? "#fff" : o.color} />
              </div>
              <div style={{ flex: compact ? 1 : "initial" }}>
                <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>{o.l}</div>
                <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2 }}>{o.hint}</div>
              </div>
              {active && (
                <div
                  style={{
                    ...(compact
                      ? { marginLeft: "auto" }
                      : { position: "absolute", top: 12, right: 12 }),
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: o.color,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={10} color="#fff" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
