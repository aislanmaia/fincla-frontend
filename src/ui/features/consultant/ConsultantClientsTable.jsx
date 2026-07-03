import React from "react";

import { Badge, Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtSgn } from "../../formatters";
import { fmtLastActive, fmtMoney, fmtPct, healthTone, trendGlyph } from "./consultantFormat";
import { ConsultantClientActionsMenu } from "./ConsultantClientActionsMenu";

const TH = { ...G, fontSize: 10.5, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left", padding: "10px 14px", whiteSpace: "nowrap" };
const TD = { ...G, fontSize: 13, color: T.ink, padding: "11px 14px", borderTop: `1px solid ${T.border}`, whiteSpace: "nowrap" };
const NUMTD = { ...TD, ...NUM, textAlign: "right" };

function Row({ client, onOpenClient }) {
  const tone = healthTone(client.health);
  const trend = trendGlyph(client.trend);
  const balance = Number(client.balance) || 0;
  const savings = Number(client.savings_pct) || 0;
  const debt = Number(client.debt_pct) || 0;
  return (
    <tr>
      <td style={{ ...TD, minWidth: 160 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...G, ...NUM, width: 34, height: 34, borderRadius: 9, background: tone.bg, color: tone.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>
            {Math.round(Number(client.health) || 0)}
          </span>
          <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{client.client_name}</span>
        </div>
      </td>
      <td style={TD}><Badge color={tone.color} bg={tone.bg}>{tone.label}</Badge></td>
      <td style={NUMTD}>{fmtMoney(client.patrimonio)}</td>
      <td style={{ ...NUMTD, color: balance < 0 ? T.red : T.ink }}>{fmtSgn(balance)}</td>
      <td style={{ ...NUMTD, color: savings < 0 ? T.red : T.ink }}>{fmtPct(savings)}</td>
      <td style={{ ...NUMTD, color: debt >= 50 ? T.red : T.ink }}>{fmtPct(debt)}</td>
      <td style={{ ...TD, textAlign: "center", color: trend.color, fontWeight: 800, fontSize: 15 }} title={`Tendência: ${client.trend}`}>{trend.glyph}</td>
      <td style={{ ...NUMTD, color: T.inkLight }}>{fmtLastActive(client.last_active)}</td>
      <td style={{ ...TD, textAlign: "right" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Btn variant="outGray" small onClick={() => onOpenClient?.(client.organization_id)}>Abrir</Btn>
          <ConsultantClientActionsMenu
            organizationId={client.organization_id}
            clientName={client.client_name}
            onOpen={onOpenClient}
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * Visão densa da carteira (A2.2). Presentational — `clients` já filtrados/ordenados
 * pela página. Rola horizontalmente no mobile (largura total, sem faixas laterais).
 */
export function ConsultantClientsTable({ clients = [], onOpenClient }) {
  return (
    <Card style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr>
            <th style={TH}>Cliente</th>
            <th style={TH}>Situação</th>
            <th style={{ ...TH, textAlign: "right" }}>Patrimônio</th>
            <th style={{ ...TH, textAlign: "right" }}>Saldo 12m</th>
            <th style={{ ...TH, textAlign: "right" }}>Poupança</th>
            <th style={{ ...TH, textAlign: "right" }}>Comprom.</th>
            <th style={{ ...TH, textAlign: "center" }}>Tend.</th>
            <th style={{ ...TH, textAlign: "right" }}>Ativo em</th>
            <th style={{ ...TH, textAlign: "right" }} aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <Row key={client.organization_id} client={client} onOpenClient={onOpenClient} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
