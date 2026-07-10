import React from "react";

import { Card } from "../../components/primitives";
import { PlanBadge } from "../entitlements/index.js";
import { T } from "../../tokens";
import { G } from "../../typography";
import { fmtLastActive } from "./consultantFormat";
import { Avatar, HealthRing, Icon, RiskBadge } from "./consultantUi";

/**
 * Botão de ação do header. `soon` desabilita com selo "em breve" (Frente B);
 * `locked` desabilita com `<PlanBadge tier="pro">` — o recurso existe, mas o
 * plano do consultor não o inclui. São motivos diferentes e selos diferentes.
 */
function HeaderAction({ variant, icon, label, soon, locked, onClick }) {
  const disabled = soon || locked;
  const styles = variant === "purple"
    ? { bg: T.purple, txt: "#fff", brd: T.purple, iconColor: "#fff" }
    : { bg: T.surface, txt: T.inkMid, brd: T.border, iconColor: T.inkMid };
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={locked ? `${label} — disponível no plano Pro` : soon ? "Em breve" : label}
      style={{
        ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
        borderRadius: 9, border: `1px solid ${styles.brd}`, background: styles.bg, color: styles.txt,
        fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon name={icon} size={14} color={styles.iconColor} />
      {label}
      {soon && (
        <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: variant === "purple" ? "#fff" : T.inkLight, background: variant === "purple" ? "rgba(255,255,255,0.2)" : T.grayLight, borderRadius: 5, padding: "1px 5px" }}>
          em breve
        </span>
      )}
      {!soon && locked && <PlanBadge tier="pro" />}
    </button>
  );
}

/**
 * Cabeçalho do relatório do cliente (RF.1b, S3) — fiel a `cons-relatorio.jsx`:
 * avatar com anel de risco, nome, `RiskBadge`, linha de contexto, `HealthRing` e
 * as ações "Avaliar com IA" (ativa desde a entrega A1) e "Enviar mensagem"
 * (Frente B → stub "em breve").
 * Presentational; recebe o `client` (item enriquecido da carteira).
 */
export function ConsultantClientReportHeader({ client, onEvaluate, evaluateLocked = false }) {
  // `Number(client.health) || 0` transformava "nunca calculado" (null) em zero, e
  // o cabeçalho mostrava "Frágil · 0" em vermelho para um cliente que ninguém
  // avaliou. `HealthRing` e `RiskBadge` já tratam `null` ("—" / "Sem score"); era
  // este cast que destruía a informação antes de chegar neles.
  const health = client.health == null ? null : Number(client.health);
  const tone = { healthy: T.greenLight, attention: T.amberLight, risk: T.redLight };
  const ringBg =
    health == null ? T.grayLight : health >= 70 ? tone.healthy : health >= 40 ? tone.attention : tone.risk;
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
            <HeaderAction variant="purple" icon="sparkles" label="Avaliar com IA"
              soon={!onEvaluate && !evaluateLocked} locked={evaluateLocked}
              onClick={onEvaluate ? () => onEvaluate(client) : undefined} />
            <HeaderAction variant="outline" icon="message" label="Enviar mensagem" soon />
          </div>
        </div>
      </div>
    </Card>
  );
}
