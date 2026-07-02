import React from "react";

import { Badge, Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtSgn } from "../../formatters";

/** Cor do selo de risco por faixa de `risk_score` (1-100, maior = pior). */
function riskTone(score) {
  if (score >= 70) return { color: T.red, bg: T.redLight };
  if (score >= 40) return { color: T.amber, bg: T.amberLight };
  return { color: T.green, bg: T.greenLight };
}

function AttentionItem({ client, onOpenClient }) {
  const tone = riskTone(client.risk_score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ ...G, ...NUM, width: 42, height: 42, borderRadius: 12, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
        {client.risk_score}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {client.client_name}
        </div>
        <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2 }}>
          {client.main_situation}
          {client.current_balance != null && (
            <span style={{ ...NUM, color: client.current_balance < 0 ? T.red : T.inkLight }}> · {fmtSgn(client.current_balance)}</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Btn variant="outGray" small onClick={() => onOpenClient?.(client.organization_id)}>
          Abrir
        </Btn>
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
 * "Precisam de atenção" (A1.3). Quatro estados explícitos, nesta prioridade:
 *   - **lista** quando há clientes em risco (de sucesso ou último-bom);
 *   - **tudo sob controle** quando já carregou com sucesso e veio vazio
 *     (`loadedOk` — base saudável), preservado mesmo em erro de refetch;
 *   - **erro** quando falhou e nunca houve sucesso (não mascara falha como
 *     base saudável);
 *   - **carregando** no primeiro fetch.
 * Presentational — dados via props. "Abrir" chama `onOpenClient` (stub até a
 * rota de relatório do cliente, S3).
 */
export function ConsultantAttentionList({ clients = [], total = 0, base = 0, loadedOk, error, onOpenClient }) {
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
    </Card>
  );
}
