import React from "react";

import { Badge, Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtAbs, fmtSgn } from "../../formatters";
import { clientHealthBand } from "./consultantClientsView";

/** Tom (cor/rótulo) por faixa de saúde — compartilhado pelo card e pela tabela. */
export function healthTone(health) {
  const band = clientHealthBand(health);
  if (band === "healthy") return { color: T.green, bg: T.greenLight, label: "Em dia" };
  if (band === "attention") return { color: T.amber, bg: T.amberLight, label: "Atenção" };
  return { color: T.red, bg: T.redLight, label: "Em risco" };
}

/** Dinheiro com sinal só quando negativo (patrimônio/saldo cru). */
export function fmtMoney(value) {
  const n = Number(value) || 0;
  return (n < 0 ? "−" : "") + fmtAbs(n);
}

/** Seta de tendência do saldo mês a mês. */
export function trendGlyph(trend) {
  if (trend === "up") return { glyph: "↑", color: T.green };
  if (trend === "down") return { glyph: "↓", color: T.red };
  return { glyph: "→", color: T.inkLight };
}

/** Última atividade em pt-BR (YYYY-MM-DD → dd/mm/aaaa), ou "—". */
export function fmtLastActive(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

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

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...G, ...NUM, width: 44, height: 44, borderRadius: 12, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
          {Math.round(client.health)}
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
        <Metric label="Poupança" value={`${client.savings_pct.toFixed(1)}%`} tone={client.savings_pct < 0 ? T.red : T.ink} />
        <Metric label="Comprometimento" value={`${client.debt_pct.toFixed(1)}%`} tone={client.debt_pct >= 50 ? T.red : T.ink} />
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
