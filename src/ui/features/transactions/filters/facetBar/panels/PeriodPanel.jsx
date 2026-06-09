import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";
import { LocaleDateRangePicker } from "../../../../../components/LocaleDateRangePicker.jsx";

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
              aria-label={`Preset: ${o.l}`}
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
          borderTop: `1px solid ${T.border}`,
          paddingTop: 14,
        }}
      >
        <LocaleDateRangePicker
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
          onCustomPeriod={() => {
            if (period !== "custom") setPeriod("custom");
          }}
          compact={compact}
        />
      </div>
    </div>
  );
}
