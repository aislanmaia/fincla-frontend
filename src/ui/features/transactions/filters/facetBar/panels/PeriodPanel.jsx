import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

const PRESETS = [
  { v: "tudo", l: "Todo período" },
  { v: "hoje", l: "Hoje" },
  { v: "semana", l: "Esta semana" },
  { v: "mes", l: "Este mês" },
  { v: "mes-ant", l: "Mês anterior" },
  { v: "3m", l: "Últimos 3m" },
  { v: "ano", l: "Este ano" },
];

export function PeriodPanel({
  period,
  setPeriod,
  customFrom = "",
  customTo = "",
  setCustomFrom = () => {},
  setCustomTo = () => {},
  onClose,
  onApply,
  compact = false,
}) {
  const applyPreset = (value) => {
    setPeriod(value);
    if (typeof onApply === "function") onApply();
  };

  return (
    <div>
      <PanelHeader
        title="Período"
        hint="Escolha um intervalo rápido ou personalize as datas"
        onClose={onClose}
        compact={compact}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {PRESETS.map((o) => {
          const active = period === o.v;
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => applyPreset(o.v)}
              aria-pressed={active}
              style={{
                ...G,
                padding: "8px 14px",
                borderRadius: 99,
                border: `1.5px solid ${active ? T.ink : T.border}`,
                background: active ? T.ink : T.surface,
                color: active ? "#fff" : T.inkMid,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {active && <Icon name="check" size={11} color="#fff" />}
              {o.l}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr",
          gap: compact ? 10 : 14,
          alignItems: "flex-start",
          borderTop: `1px solid ${T.border}`,
          paddingTop: 14,
        }}
      >
        <div>
          <FieldLabel>De</FieldLabel>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              if (period !== "custom") setPeriod("custom");
            }}
            aria-label="Data inicial"
            style={dateInputStyle}
          />
        </div>
        <div>
          <FieldLabel>Até</FieldLabel>
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              if (period !== "custom") setPeriod("custom");
            }}
            aria-label="Data final"
            style={dateInputStyle}
          />
        </div>
        {!compact && (
          <div>
            <FieldLabel>Intervalo</FieldLabel>
            <div
              style={{
                ...G,
                ...MONO,
                padding: "9px 11px",
                borderRadius: 9,
                background: T.bg,
                border: `1px solid ${T.border}`,
                fontSize: 13,
                color: T.inkMid,
              }}
            >
              {describeRange(customFrom, customTo)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        ...G,
        fontSize: 10,
        fontWeight: 700,
        color: T.inkMid,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const dateInputStyle = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: `1px solid ${T.border}`,
  fontSize: 13,
  outline: "none",
  color: T.ink,
  background: T.surface,
  boxSizing: "border-box",
  fontFamily: "'Geist', sans-serif",
};

function describeRange(from, to) {
  if (!from && !to) return "—";
  if (from && to) {
    const a = new Date(`${from}T00:00:00`);
    const b = new Date(`${to}T00:00:00`);
    const days = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
    if (Number.isFinite(days) && days > 0) return `${days} dia${days === 1 ? "" : "s"}`;
  }
  return from || to;
}
