import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { PanelHeader } from "./PanelHeader.jsx";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function ValuePanel({
  valueMin,
  valueMax,
  setValueMin,
  setValueMax,
  counts,
  onClose,
  compact = false,
}) {
  const buckets = counts?.buckets;
  const peak = Array.isArray(buckets) ? Math.max(1, ...buckets.map((b) => b.count)) : 1;

  /**
   * Clicar numa barra escreve a faixa DELA nos campos. As duas pontas do
   * bucket são inclusivas no backend — é por isso que ele devolve `to: 49.99`
   * e não `to: 50`: mandar 50 traria também as linhas da barra seguinte, e a
   * barra entregaria um número diferente do que ela mesma mostra.
   */
  const applyBucket = (b) => {
    const active = isBucketActive(b, valueMin, valueMax);
    if (active) {
      setValueMin("");
      setValueMax("");
      return;
    }
    setValueMin(b.from == null ? "" : formatBrl(b.from));
    setValueMax(b.to == null ? "" : formatBrl(b.to));
  };

  return (
    <div>
      <PanelHeader
        title="Faixa de valor"
        hint="Filtre por valor absoluto da transação"
        onClose={onClose}
        compact={compact}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
          gap: compact ? 12 : 16,
        }}
      >
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
      {Array.isArray(buckets) && buckets.some((b) => b.count > 0) && (
        <div style={{ marginTop: compact ? 14 : 18 }}>
          <div
            style={{
              ...G,
              fontSize: 11,
              fontWeight: 700,
              color: T.inkMid,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Distribuição
          </div>
          <div
            role="group"
            aria-label="Distribuição por faixa de valor"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
              gap: 4,
              alignItems: "end",
              height: 64,
            }}
          >
            {buckets.map((b) => {
              const active = isBucketActive(b, valueMin, valueMax);
              const label = bucketLabel(b);
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => applyBucket(b)}
                  aria-pressed={active}
                  aria-label={`${label}: ${b.count} ${b.count === 1 ? "transação" : "transações"}`}
                  title={`${label} · ${b.count}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    alignItems: "stretch",
                    gap: 4,
                    height: "100%",
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: b.count === 0 ? "default" : "pointer",
                    opacity: b.count === 0 ? 0.4 : 1,
                  }}
                  disabled={b.count === 0}
                >
                  <span
                    style={{
                      ...G,
                      ...MONO,
                      fontSize: 11,
                      fontWeight: 700,
                      color: active ? T.ink : T.inkLight,
                      textAlign: "center",
                    }}
                  >
                    {b.count}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      // Piso de 3px: uma faixa com poucas transações precisa
                      // continuar clicável, e uma barra de 0px não é alvo.
                      height: Math.max(3, Math.round((b.count / peak) * 34)),
                      borderRadius: 3,
                      background: active ? T.ink : T.border,
                      transition: "background 120ms ease",
                    }}
                  />
                  <span
                    style={{
                      ...G,
                      fontSize: 11,
                      color: T.inkLight,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {bucketShortLabel(b)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** `1234.5` → `"1234,50"`, o formato que os campos desta tela aceitam de volta. */
function formatBrl(n) {
  return n.toFixed(2).replace(".", ",");
}

function bucketLabel(b) {
  if (b.from == null) return `Até R$ ${formatBrl(b.to)}`;
  if (b.to == null) return `R$ ${formatBrl(b.from)} ou mais`;
  return `R$ ${formatBrl(b.from)} a ${formatBrl(b.to)}`;
}

function bucketShortLabel(b) {
  const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));
  if (b.from == null) return `<${k(b.to + 0.01)}`;
  if (b.to == null) return `${k(b.from)}+`;
  return k(b.from);
}

/** A barra está acesa quando os campos contêm exatamente a faixa dela. */
function isBucketActive(b, valueMin, valueMax) {
  const want = (n) => (n == null ? "" : formatBrl(n));
  return (valueMin || "") === want(b.from) && (valueMax || "") === want(b.to);
}

function ValueField({ label, value, placeholder, ariaLabel, onChange }) {
  return (
    <div>
      <div
        style={{
          ...G,
          fontSize: 11,
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
