import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Donut } from "./consultantUi";
import { buildBaseSemaphore } from "./consultantBaseSemaphore";

/**
 * Semáforo da carteira (RF.5, fiel ao `RiskDonutPanel` da referência). Donut
 * **3-vias** (Saudável / Atenção / Em risco) contado pela saúde por-cliente da
 * carteira (`useConsultantClients`), com a saúde média agregada (`health-index`)
 * no centro. Presentational — recebe os clientes + agregado via props.
 */
export function ConsultantSemaphorePanel({ clients = [], hasLoaded, healthIndex, loading }) {
  const { counts, total, splitAvailable, centerValue } = buildBaseSemaphore({ clients, hasLoaded, healthIndex });

  // "Frágil", não "Em risco": risco é o gatilho por regras de "Precisam de atenção".
  // "Sem score" só aparece quando existe alguém nele — é um estado transitório.
  const segments = [
    { id: "healthy", label: "Saudável", value: counts.healthy, color: T.green },
    { id: "attention", label: "Atenção", value: counts.attention, color: T.amber },
    { id: "risk", label: "Frágil", value: counts.risk, color: T.red },
    ...(counts.none > 0 ? [{ id: "none", label: "Sem score", value: counts.none, color: T.inkGhost }] : []),
  ];

  const center = (
    <>
      <span style={{ ...G, ...NUM, fontSize: 24, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{centerValue}</span>
      <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>saúde média</span>
    </>
  );

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Semáforo da carteira</div>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
        {total} {total === 1 ? "cliente" : "clientes"} por nível de saúde
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Donut segments={splitAvailable ? segments : []} size={128} stroke={17} center={center} />
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
