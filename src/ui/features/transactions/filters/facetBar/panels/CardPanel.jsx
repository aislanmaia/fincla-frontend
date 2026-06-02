import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function CardPanel({ cardSel, setCardSel, cards = [], onClose, compact = false }) {
  return (
    <div>
      <PanelHeader
        title="Cartão"
        hint="Filtre por um ou mais cartões cadastrados"
        onClose={onClose}
        compact={compact}
      />
      {cards.length === 0 ? (
        <div
          style={{
            ...G,
            padding: 16,
            background: T.bg,
            borderRadius: 10,
            color: T.inkLight,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Nenhum cartão cadastrado.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr",
            gap: 10,
          }}
        >
          {cards.map((c) => {
            const active = cardSel.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  setCardSel(active ? cardSel.filter((x) => x !== c.id) : [...cardSel, c.id])
                }
                aria-pressed={active}
                aria-label={c.label}
                style={{
                  ...G,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `1.5px solid ${active ? T.ink : T.border}`,
                  background: active ? T.bg : T.surface,
                  cursor: "pointer",
                  textAlign: "left",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 36,
                    borderRadius: 6,
                    background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`,
                    position: "relative",
                    boxShadow: "inset 0 -8px 12px rgba(0,0,0,0.12)",
                  }}
                >
                  {c.last4 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 6,
                        color: "#fff",
                        ...MONO,
                        fontSize: 9,
                        fontWeight: 700,
                        opacity: 0.95,
                      }}
                    >
                      ●●{c.last4}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>
                    {c.label}
                  </div>
                  {c.subtitle && (
                    <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
                      {c.subtitle}
                    </div>
                  )}
                </div>
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: T.ink,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" size={11} color="#fff" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
