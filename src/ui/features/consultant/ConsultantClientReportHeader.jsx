import React from "react";

import { Badge, Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtSgn } from "../../formatters";
import { fmtLastActive, fmtMoney, fmtPct, healthTone, trendGlyph } from "./consultantFormat";

function Stat({ label, value, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...G, fontSize: 10.5, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: tone ?? T.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Cabeçalho do relatório do cliente (A3.1, S3). Presentational — recebe o
 * `client` (mesma forma enriquecida da carteira) e `onBack` (volta para a
 * carteira). Mostra saúde/situação, patrimônio e os KPIs de 12m; as abas do
 * relatório (Visão geral, Transações, Cartões, Categorias) chegam em A3.2+.
 */
export function ConsultantClientReportHeader({ client, onBack }) {
  const tone = healthTone(client.health);
  const trend = trendGlyph(client.trend);
  const balance = Number(client.balance) || 0;
  const savings = Number(client.savings_pct) || 0;
  const debt = Number(client.debt_pct) || 0;
  const showOrg = client.organization_name && client.organization_name !== client.client_name;

  return (
    <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Btn variant="outGray" small onClick={onBack}>← Voltar para a carteira</Btn>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ ...G, ...NUM, width: 52, height: 52, borderRadius: 14, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
          {Math.round(Number(client.health) || 0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {client.client_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <Badge color={tone.color} bg={tone.bg}>{tone.label}</Badge>
            {showOrg && (
              <span style={{ ...G, fontSize: 12, color: T.inkLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {client.organization_name}
              </span>
            )}
          </div>
        </div>
        <div title={`Tendência: ${client.trend}`} style={{ ...G, fontSize: 22, fontWeight: 800, color: trend.color, flexShrink: 0 }}>
          {trend.glyph}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "14px 16px", borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <Stat label="Patrimônio" value={fmtMoney(client.patrimonio)} />
        <Stat label="Saldo 12m" value={fmtSgn(balance)} tone={balance < 0 ? T.red : T.ink} />
        <Stat label="Poupança" value={fmtPct(savings)} tone={savings < 0 ? T.red : T.ink} />
        <Stat label="Comprometimento" value={fmtPct(debt)} tone={debt >= 50 ? T.red : T.ink} />
        <Stat label="Ativo em" value={fmtLastActive(client.last_active)} tone={T.inkLight} />
      </div>
    </Card>
  );
}
