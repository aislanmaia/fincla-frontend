import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { buildConsultantKpis } from "./consultantKpis";

function KpiCard({ label, value, sub, accent, soon }) {
  return (
    <Card style={{ padding: "15px 17px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>
            {label}
          </div>
          <div style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: soon ? T.inkGhost : T.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
            <span style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{sub}</span>
          </div>
        </div>
        {soon && (
          <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkLight, background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 99, padding: "2px 7px", whiteSpace: "nowrap" }}>
            em breve
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * KPIs do topo do Painel da base (A1.2). Card grid responsivo: 1 coluna no
 * mobile, 2 em telas médias, 4 no desktop. Consome o modelo puro
 * `buildConsultantKpis`; recebe os agregados via props (a página faz o fetch).
 */
export function ConsultantKpiCards({ summary, healthIndex, isLoading }) {
  const kpis = buildConsultantKpis({ summary, healthIndex, isLoading });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}
    >
      {kpis.map(({ id, ...kpi }) => (
        <KpiCard key={id} {...kpi} />
      ))}
    </div>
  );
}
