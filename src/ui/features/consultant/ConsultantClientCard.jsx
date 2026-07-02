import React from "react";

import { Badge, Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtSgn } from "../../formatters";
import { fmtLastActive, fmtMoney, fmtPct, healthTone, trendGlyph } from "./consultantFormat";

function Metric({ label, value, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...G, fontSize: 10.5, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 13.5, fontWeight: 700, color: tone ?? T.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Card de um cliente da carteira (A2.2). Presentational — dados via `client`
 * (`ConsultantClient` enriquecido). "Abrir" chama `onOpenClient(organization_id)`
 * (stub até a rota de relatório do cliente, S3).
 */
export function ConsultantClientCard({ client, onOpenClient }) {
  const tone = healthTone(client.health);
  const trend = trendGlyph(client.trend);
  const balance = Number(client.balance) || 0;
  const savings = Number(client.savings_pct) || 0;
  const debt = Number(client.debt_pct) || 0;

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...G, ...NUM, width: 44, height: 44, borderRadius: 12, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
          {Math.round(Number(client.health) || 0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.client_name}
          </div>
          <div style={{ marginTop: 3 }}>
            <Badge color={tone.color} bg={tone.bg}>{tone.label}</Badge>
          </div>
        </div>
        <div title={`Tendência: ${client.trend}`} style={{ ...G, fontSize: 18, fontWeight: 800, color: trend.color, flexShrink: 0 }}>
          {trend.glyph}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
        <Metric label="Patrimônio" value={fmtMoney(client.patrimonio)} />
        <Metric label="Saldo 12m" value={fmtSgn(balance)} tone={balance < 0 ? T.red : T.ink} />
        <Metric label="Poupança" value={fmtPct(savings)} tone={savings < 0 ? T.red : T.ink} />
        <Metric label="Comprometimento" value={fmtPct(debt)} tone={debt >= 50 ? T.red : T.ink} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <div style={{ ...G, fontSize: 11, color: T.inkLight }}>
          Ativo em <span style={{ ...NUM }}>{fmtLastActive(client.last_active)}</span>
        </div>
        <Btn variant="outGray" small onClick={() => onOpenClient?.(client.organization_id)}>
          Abrir
        </Btn>
      </div>
    </Card>
  );
}
