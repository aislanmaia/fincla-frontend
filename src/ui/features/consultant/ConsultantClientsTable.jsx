import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtMoney, fmtPct } from "./consultantFormat";
import { Avatar, HealthRing, Icon, RiskBadge } from "./consultantUi";
import { ConsultantClientActions } from "./ConsultantClientActions";

const TH = { ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left", padding: "11px 18px", whiteSpace: "nowrap", background: T.bg };
const TD = { ...G, fontSize: 13, color: T.ink, padding: "12px 18px", borderTop: `1px solid ${T.border}`, whiteSpace: "nowrap", verticalAlign: "middle" };

const debtColor = (v) => (v <= 30 ? T.green : v <= 50 ? T.amber : T.red);

function Row({ client, onOpenClient, onRegenerate, onEvaluate }) {
  const debt = Number(client.debt_pct) || 0;
  const trendUp = client.trend === "up";
  const trendDown = client.trend === "down";
  const trendColor = trendUp ? T.green : trendDown ? T.red : T.inkLight;
  return (
    <tr
      onClick={() => onOpenClient?.(client.organization_id)}
      style={{ cursor: "pointer" }}
    >
      <td style={{ ...TD, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <Avatar name={client.client_name} seed={client.organization_id} size={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis" }}>{client.client_name}</div>
            <div style={{ ...G, fontSize: 10.5, color: T.inkLight, overflow: "hidden", textOverflow: "ellipsis" }}>{client.organization_name}</div>
          </div>
        </div>
      </td>
      <td style={TD}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <HealthRing health={client.health} size={32} stroke={4} />
          <RiskBadge health={client.health} />
        </div>
      </td>
      <td style={{ ...TD, ...NUM, fontWeight: 700 }}>{fmtMoney(client.patrimonio)}</td>
      <td style={TD}>
        <span style={{ ...G, ...NUM, fontSize: 12.5, fontWeight: 700, color: debtColor(debt) }}>{fmtPct(debt)}</span>
      </td>
      <td style={{ ...TD, textAlign: "center" }} title={`Tendência: ${client.trend}`}>
        <Icon name={trendUp ? "up" : trendDown ? "down" : "trending"} size={15} color={trendColor} />
      </td>
      <td style={{ ...TD, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "inline-flex", justifyContent: "flex-end" }}>
          <ConsultantClientActions
            onOpen={() => onOpenClient?.(client.organization_id)}
            showOpen
            pending={!!client.pending_activation}
            onRegenerate={() => onRegenerate?.(client.organization_id)}
            onEvaluate={onEvaluate ? () => onEvaluate(client) : undefined}
            radius={7}
            pad="6px 8px"
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * Visão densa da carteira (RF.6, fiel a `ClientRow` da referência): Cliente
 * (Avatar+nome+org) · Saúde (HealthRing+RiskBadge) · Patrimônio · Renda compr. ·
 * Tendência · ações. Linha clicável → relatório. `clients` já filtrados/ordenados
 * pela página. Rola horizontalmente no mobile (largura total, sem faixas laterais).
 */
export function ConsultantClientsTable({ clients = [], onOpenClient, onRegenerate, onEvaluate }) {
  return (
    <Card style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr>
            <th style={TH}>Cliente</th>
            <th style={TH}>Saúde</th>
            <th style={TH}>Patrimônio</th>
            <th style={TH}>Renda compr.</th>
            <th style={{ ...TH, textAlign: "center" }}>Tendência</th>
            <th style={{ ...TH, textAlign: "right" }} aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <Row key={client.organization_id} client={client} onOpenClient={onOpenClient} onRegenerate={onRegenerate} onEvaluate={onEvaluate} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
