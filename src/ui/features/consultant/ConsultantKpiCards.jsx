import React from "react";

import { Badge, Card } from "../../components/primitives";
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
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 7 }}>{sub}</div>
        </div>
        {soon && <Badge color={T.inkLight} bg={T.grayLight}>em breve</Badge>}
      </div>
    </Card>
  );
}

/**
 * KPIs do topo do Painel da base (A1.2). Grid responsivo via
 * `auto-fit, minmax(180px, 1fr)`: os cards se distribuem por coluna conforme a
 * largura disponível (1 coluna no mobile estreito, mais colunas à medida que
 * cabem, até os 4 lado a lado em telas largas). Consome o modelo puro
 * `buildConsultantKpis`; recebe o agregado + `hasLoaded` via props (a página
 * faz o fetch).
 */
export function ConsultantKpiCards({ healthIndex, hasLoaded, patrimonio, patrimonioLoaded, attention, attentionLoaded }) {
  const kpis = buildConsultantKpis({ healthIndex, hasLoaded, patrimonio, patrimonioLoaded, attention, attentionLoaded });
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
