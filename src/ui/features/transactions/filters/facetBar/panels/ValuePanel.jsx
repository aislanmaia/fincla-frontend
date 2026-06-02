import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { PanelHeader } from "./PanelHeader.jsx";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function ValuePanel({ valueMin, valueMax, setValueMin, setValueMax, onClose }) {
  return (
    <div>
      <PanelHeader
        title="Faixa de valor"
        hint="Filtre por valor absoluto da transação"
        onClose={onClose}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ValueField
          label="Mínimo"
          value={valueMin}
          placeholder="0,00"
          ariaLabel="Valor mínimo"
          onChange={setValueMin}
        />
        <ValueField
          label="Máximo"
          value={valueMax}
          placeholder="sem limite"
          ariaLabel="Valor máximo"
          onChange={setValueMax}
        />
      </div>
    </div>
  );
}

function ValueField({ label, value, placeholder, ariaLabel, onChange }) {
  return (
    <div>
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
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "9px 12px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          background: T.surface,
        }}
      >
        <span style={{ ...G, fontSize: 12, color: T.inkLight, fontWeight: 600 }}>R$</span>
        <input
          value={value || ""}
          placeholder={placeholder}
          aria-label={ariaLabel}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...G,
            ...MONO,
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 14,
            color: T.ink,
            fontWeight: 600,
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
}
