import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { fmtLastActive } from "./consultantFormat";
import { Avatar, HealthRing, Icon, RiskBadge } from "./consultantUi";

/** Botão de ação do header. `soon` desabilita com selo "em breve" (Trilha B). */
function HeaderAction({ variant, icon, label, soon }) {
  const styles = variant === "purple"
    ? { bg: T.purple, txt: "#fff", brd: T.purple, iconColor: "#fff" }
    : { bg: T.surface, txt: T.inkMid, brd: T.border, iconColor: T.inkMid };
  return (
    <button
      type="button"
      disabled={soon}
      title={soon ? "Em breve" : undefined}
      style={{
        ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
        borderRadius: 9, border: `1px solid ${styles.brd}`, background: styles.bg, color: styles.txt,
        fontSize: 13, fontWeight: 700, cursor: soon ? "default" : "pointer", whiteSpace: "nowrap",
        opacity: soon ? 0.55 : 1,
      }}
    >
      <Icon name={icon} size={14} color={styles.iconColor} />
      {label}
      {soon && (
        <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: variant === "purple" ? "#fff" : T.inkLight, background: variant === "purple" ? "rgba(255,255,255,0.2)" : T.grayLight, borderRadius: 5, padding: "1px 5px" }}>
          em breve
        </span>
      )}
    </button>
  );
}

/**
 * Cabeçalho do relatório do cliente (RF.1b, S3) — fiel a `cons-relatorio.jsx`:
 * avatar com anel de risco, nome, `RiskBadge`, linha de contexto, `HealthRing` e
 * as ações "Avaliar com IA" / "Enviar mensagem" (Trilha B → stub "em breve").
 * Presentational; recebe o `client` (item enriquecido da carteira).
 */
export function ConsultantClientReportHeader({ client }) {
  const health = Number(client.health) || 0;
  const tone = { healthy: T.greenLight, attention: T.amberLight, risk: T.redLight };
  const ringBg = health >= 70 ? tone.healthy : health >= 40 ? tone.attention : tone.risk;
  const showOrg = client.organization_name && client.organization_name !== client.client_name;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Avatar name={client.client_name} seed={client.organization_id} size={58} ring={ringBg} />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ ...G, margin: 0, fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>{client.client_name}</h1>
            <RiskBadge health={health} />
          </div>
          <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 4 }}>
            {showOrg ? `${client.organization_name} · ` : ""}ativo em {fmtLastActive(client.last_active)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <HealthRing health={health} size={64} stroke={6} />
            <div style={{ ...G, fontSize: 9.5, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 5 }}>Saúde</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <HeaderAction variant="purple" icon="sparkles" label="Avaliar com IA" soon />
            <HeaderAction variant="outline" icon="message" label="Enviar mensagem" soon />
          </div>
        </div>
      </div>
    </Card>
  );
}
