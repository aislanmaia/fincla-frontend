import React from "react";

import { Badge, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { fmtSgn } from "../../formatters";
import { HealthRing, Icon } from "./consultantUi";

/** Saúde (0-100, maior=melhor) derivada do `risk_score` (1-100, maior=pior). */
function healthFromRisk(score) {
  const s = Number(score) || 0;
  return Math.max(0, Math.min(100, 100 - s));
}

function AttentionItem({ client, onOpenClient }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${T.border}` }}>
      <HealthRing health={healthFromRisk(client.risk_score)} size={42} stroke={4} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ ...G, fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}
          onClick={() => onOpenClient?.(client.organization_id)}
        >
          {client.client_name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
          {client.main_situation && (
            <span style={{ ...G, fontSize: 10.5, color: T.red, background: T.redLight, borderRadius: 99, padding: "2px 8px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="alert" size={10} color={T.red} />{client.main_situation}
            </span>
          )}
          {client.current_balance != null && client.current_balance < 0 && (
            <span style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{fmtSgn(client.current_balance)}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
        {/* "Avaliar com IA" = Trilha B → stub "em breve". */}
        <button
          type="button"
          disabled
          title="Avaliar com IA (em breve)"
          style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, background: T.purpleLight, color: T.purple, border: "none", borderRadius: 8, padding: "7px 11px", fontSize: 11.5, fontWeight: 700, cursor: "default", opacity: 0.6 }}
        >
          <Icon name="sparkles" size={12} color={T.purple} /> Avaliar
        </button>
        <button
          type="button"
          onClick={() => onOpenClient?.(client.organization_id)}
          title="Abrir relatório"
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex" }}
        >
          <Icon name="arrow-right" size={13} color={T.inkMid} />
        </button>
      </div>
    </div>
  );
}

function AttentionMessage({ tone, title, text }) {
  return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 13, ...G, fontSize: 22 }}>
        {tone.glyph}
      </div>
      <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 340 }}>{text}</div>
    </div>
  );
}

/**
 * "Precisam de atenção" do Painel da base (RF.5, fiel ao `attentionCard` da
 * referência): por cliente, `HealthRing` + nome + situação (pílula) + ações
 * (Avaliar com IA = stub "em breve"; Abrir → relatório). Rodapé "Ver todos os
 * clientes". Mantém os quatro estados explícitos (A1.3), nesta prioridade:
 *   - **lista** quando há clientes em risco;
 *   - **tudo sob controle** quando carregou com sucesso e veio vazio (`loadedOk`);
 *   - **erro** quando falhou e nunca houve sucesso;
 *   - **carregando** no primeiro fetch.
 * Presentational — dados via props.
 */
export function ConsultantAttentionList({ clients = [], total = 0, base = 0, loadedOk, error, onOpenClient, onViewAll }) {
  const hasClients = clients.length > 0;
  const state = hasClients ? "list" : loadedOk ? "clear" : error ? "error" : "loading";

  const PILLS = {
    list: <Badge color={T.red} bg={T.redLight}>{`${total}${base ? ` de ${base}` : ""}`}</Badge>,
    clear: <Badge color={T.green} bg={T.greenLight}>0 alertas</Badge>,
    error: <Badge color={T.inkLight} bg={T.grayLight}>indisponível</Badge>,
    loading: <Badge color={T.inkLight} bg={T.grayLight}>…</Badge>,
  };
  const SUBTITLES = {
    list: "Ordenados pela maior pontuação de risco",
    clear: "Base monitorada em tempo real",
    error: "Não foi possível carregar os clientes em risco",
    loading: "Carregando clientes em risco…",
  };

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "15px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Precisam de atenção</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{SUBTITLES[state]}</div>
        </div>
        {PILLS[state]}
      </div>
      <div style={{ height: 1, background: T.border }} />
      {state === "list" &&
        clients.map((client) => (
          <AttentionItem key={client.organization_id} client={client} onOpenClient={onOpenClient} />
        ))}
      {state === "clear" && (
        <AttentionMessage
          tone={{ color: T.green, bg: T.greenLight, glyph: "✓" }}
          title="Tudo sob controle"
          text="Nenhum cliente em risco no momento. Toda a base está com saúde financeira saudável."
        />
      )}
      {state === "error" && (
        <AttentionMessage
          tone={{ color: T.red, bg: T.redLight, glyph: "!" }}
          title="Não foi possível carregar"
          text="Houve um erro ao buscar os clientes em risco. Tente atualizar em instantes."
        />
      )}
      {state === "loading" && (
        <AttentionMessage
          tone={{ color: T.inkLight, bg: T.grayLight, glyph: "…" }}
          title="Carregando…"
          text="Buscando os clientes que precisam de atenção."
        />
      )}
      {state === "list" && (
        <button
          type="button"
          onClick={onViewAll}
          style={{ ...G, width: "100%", background: "transparent", border: "none", borderTop: `1px solid ${T.border}`, padding: "12px", fontSize: 12.5, fontWeight: 700, color: T.inkMid, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          Ver todos os clientes <Icon name="arrow-right" size={13} color={T.inkMid} />
        </button>
      )}
    </Card>
  );
}
