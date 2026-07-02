import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { buildRiskSemaphore } from "./consultantRiskSemaphore";

/** Donut SVG puro: desenha os segmentos como arcos e o valor central. */
function RiskDonut({ segments, centerValue, size = 128, stroke = 17 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Semáforo da carteira">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
        {total > 0 &&
          segments.map((seg) => {
            const len = (seg.value / total) * circ;
            const dash = `${len} ${circ - len}`;
            const el = (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ ...G, ...NUM, fontSize: 24, fontWeight: 800, fill: T.ink }}>
        {centerValue}
      </text>
      <text x="50%" y="61%" textAnchor="middle" dominantBaseline="middle" style={{ ...G, fontSize: 9, fontWeight: 700, fill: T.inkLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        saúde média
      </text>
    </svg>
  );
}

/**
 * Semáforo da carteira (A1.3). Donut 2-vias (Precisam de atenção / Em dia)
 * derivado de `/clients-at-risk` + `organizations_count`, com a saúde média
 * agregada no centro. A divisão em 3 vias (saudável/atenção/em risco) fica p/
 * pós-A2.0 (exige saúde por-cliente). Não faz fetch — recebe os agregados via
 * props.
 */
export function ConsultantSemaphorePanel({ atRiskTotal, organizationsCount, healthIndex, hasLoaded, loading }) {
  const { segments, base, centerValue, splitAvailable } = buildRiskSemaphore({
    atRiskTotal,
    organizationsCount,
    healthIndex,
    hasLoaded,
  });

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Semáforo da carteira</div>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
        {base} {base === 1 ? "cliente" : "clientes"} na carteira
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <RiskDonut segments={segments} centerValue={centerValue} />
        <div style={{ flex: 1, minWidth: 130, display: "flex", flexDirection: "column", gap: 11 }}>
          {splitAvailable ? (
            segments.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ ...G, fontSize: 12, color: T.inkMid, flex: 1 }}>{s.label}</span>
                <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: T.ink }}>{s.value}</span>
              </div>
            ))
          ) : (
            <span style={{ ...G, fontSize: 12, color: T.inkLight }}>
              {loading ? "Carregando distribuição…" : "Distribuição de risco indisponível."}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
