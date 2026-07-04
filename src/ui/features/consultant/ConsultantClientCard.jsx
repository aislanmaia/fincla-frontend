import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtLastActive, fmtMoney, fmtPct } from "./consultantFormat";
import { Avatar, HealthRing, Icon, RiskBadge } from "./consultantUi";
import { ConsultantClientActions } from "./ConsultantClientActions";

function MiniStat({ label, value, color = T.ink }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...G, fontSize: 9.5, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
}

/** Cor semântica de poupança/comprometimento (fiel à referência). */
const savingsColor = (v) => (v >= 15 ? T.green : v >= 0 ? T.amber : T.red);
const debtColor = (v) => (v <= 30 ? T.green : v <= 50 ? T.amber : T.red);

/**
 * Card de um cliente da carteira (RF.6, fiel a `ClientCard` da referência):
 * Avatar + nome + org + `HealthRing`; mini-stats (Patrimônio / Poupança /
 * Comprometimento) + tendência; rodapé com `RiskBadge` + última atividade + ações
 * inline (Avaliar/Mensagem = stubs "em breve"). O card inteiro é clicável → abre o
 * relatório. Presentational — dados via `client` (`ConsultantClient` enriquecido).
 */
export function ConsultantClientCard({ client, onOpenClient }) {
  const savings = Number(client.savings_pct) || 0;
  const debt = Number(client.debt_pct) || 0;
  const trendUp = client.trend === "up";
  const trendDown = client.trend === "down";
  const trendColor = trendUp ? T.green : trendDown ? T.red : T.inkLight;

  return (
    <Card
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 13, cursor: "pointer" }}
      onClick={() => onOpenClient?.(client.organization_id)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={client.client_name} seed={client.organization_id} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.client_name}</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.organization_name}</div>
        </div>
        <HealthRing health={client.health} size={44} stroke={4.5} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "11px 0", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
        <MiniStat label="Patrimônio" value={fmtMoney(client.patrimonio)} />
        <MiniStat label="Poupança" value={fmtPct(savings)} color={savingsColor(savings)} />
        <MiniStat label="Comprom." value={fmtPct(debt)} color={debtColor(debt)} />
        <div title={`Tendência: ${client.trend}`} style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <Icon name={trendUp ? "up" : trendDown ? "down" : "trending"} size={14} color={trendColor} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RiskBadge health={client.health} />
        <span style={{ ...G, fontSize: 10.5, color: T.inkGhost, marginLeft: "auto" }}>{fmtLastActive(client.last_active)}</span>
        <ConsultantClientActions />
      </div>
    </Card>
  );
}
