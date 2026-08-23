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
    // Clicar na barra que JÁ é a faixa inteira desmarca — o mesmo gesto
    // desfaz, sem precisar de um segundo controle para limpar.
    const soEla =
      parseBrl(valueMin) === (b.from == null ? null : b.from) &&
      parseBrl(valueMax) === (b.to == null ? null : b.to);
    if (soEla) {
      setValueMin("");
      setValueMax("");
      return;
    }
    setValueMin(b.from == null ? "" : formatBrl(b.from));
    setValueMax(b.to == null ? "" : formatBrl(b.to));
  };

  const min = parseBrl(valueMin);
  const max = parseBrl(valueMax);
  const temFaixa = min != null || max != null;
  const edges = Array.isArray(buckets) ? bucketEdges(buckets, min, max) : { first: -1, last: -1 };
  const temBarras = Array.isArray(buckets) && buckets.some((b) => b.count > 0);

  /* Atalhos: o caminho de um clique para os três recortes que respondem a
     quase toda pergunta sobre valor. As faixas do backend são fechadas nos
     dois lados, daí o `.99` — mandar 250 traria também a barra seguinte, e o
     atalho entregaria um número diferente do que o rótulo promete. */
  const ATALHOS = [
    { label: "até R$ 50", from: null, to: 49.99 },
    { label: "R$ 50–250", from: 50, to: 249.99 },
    { label: "acima de R$ 250", from: 250, to: null },
  ];
  const atalhoAtivo = (a) =>
    (a.from == null ? min == null : min === a.from) && (a.to == null ? max == null : max === a.to);
  const aplicarAtalho = (a) => {
    if (atalhoAtivo(a)) {
      setValueMin("");
      setValueMax("");
      return;
    }
    setValueMin(a.from == null ? "" : formatBrl(a.from));
    setValueMax(a.to == null ? "" : formatBrl(a.to));
  };

  return (
    <div>
      <PanelHeader
        title="Faixa de valor"
        hint="Em módulo: receita ou despesa"
        onClose={onClose}
        compact={compact}
      />

      {/* O histograma vem ANTES dos campos. Pedir "valor mínimo" a quem não
          conhece a distribuição dos próprios gastos é pedir um chute; com as
          barras à vista a escolha vira leitura. */}
      {temBarras && (
        <div
          role="group"
          aria-label="Distribuição por faixa de valor"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
            gap: 4,
            alignItems: "end",
            height: 64,
            marginBottom: 6,
          }}
        >
          {buckets.map((b, i) => {
            const dentro = temFaixa && isBucketInRange(b, min, max);
            const ponta = dentro && (i === edges.first || i === edges.last);
            const label = bucketLabel(b);
            return (
              <button
                type="button"
                key={label}
                onClick={() => applyBucket(b)}
                aria-pressed={dentro}
                aria-label={`${label}: ${b.count} ${b.count === 1 ? "transação" : "transações"}`}
                title={`${label} · ${b.count}`}
                disabled={b.count === 0}
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
              >
                <span
                  style={{
                    ...G,
                    ...MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    color: ponta ? T.ink : dentro ? T.blue : T.inkLight,
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
                    borderRadius: "3px 3px 0 0",
                    // Ponta escura, miolo azul: com 30 a 800 digitado à mão as
                    // cinco barras da faixa acendem e as duas das pontas dizem
                    // onde ela começa e termina.
                    background: ponta ? T.ink : dentro ? T.blue : T.border,
                    transition: "background 120ms ease",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
      {temBarras && (
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
            gap: 4,
            marginBottom: compact ? 12 : 16,
          }}
        >
          {buckets.map((b) => (
            <span
              key={bucketLabel(b)}
              style={{
                ...G,
                ...MONO,
                fontSize: 10,
                color: T.inkLight,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {bucketShortLabel(b)}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
          gap: compact ? 10 : 16,
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: compact ? 12 : 14 }}>
        {ATALHOS.map((a) => {
          const on = atalhoAtivo(a);
          return (
            <button
              type="button"
              key={a.label}
              onClick={() => aplicarAtalho(a)}
              aria-pressed={on}
              style={{
                ...G,
                height: 30,
                padding: "0 11px",
                borderRadius: 99,
                border: `1px solid ${on ? T.ink : T.border}`,
                background: on ? T.ink : T.surface,
                color: on ? "#fff" : T.inkMid,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>
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

/** `"1.234,50"` → `1234.5`. Vazio ou lixo vira `null`, que significa sem limite. */
export function parseBrl(v) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * A barra está acesa quando ela INTERSECTA a faixa escolhida — não quando os
 * campos batem exatamente com os limites dela.
 *
 * A regra anterior era exata, e por isso o histograma só acendia se a pessoa
 * tivesse clicado numa barra: digitar 30 a 800 à mão deixava as seis apagadas,
 * e o histograma virava enfeite justamente para quem estava mirando uma faixa
 * própria. Como as faixas do backend são fechadas nos dois lados, a
 * intersecção usa `>=` e `<=` dos dois lados.
 */
export function isBucketInRange(b, min, max) {
  const lo = b.from == null ? Number.NEGATIVE_INFINITY : b.from;
  const hi = b.to == null ? Number.POSITIVE_INFINITY : b.to;
  return (min == null || hi >= min) && (max == null || lo <= max);
}

/** A barra é PONTA quando é a primeira ou a última dentro da faixa. */
export function bucketEdges(buckets, min, max) {
  const idx = buckets.map((b, i) => (isBucketInRange(b, min, max) ? i : -1)).filter((i) => i >= 0);
  return idx.length ? { first: idx[0], last: idx[idx.length - 1] } : { first: -1, last: -1 };
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
