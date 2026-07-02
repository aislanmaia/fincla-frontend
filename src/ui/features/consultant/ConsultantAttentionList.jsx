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
 * "Precisam de atenção" (A1.3). Lista os clientes em risco de `/clients-at-risk`
 * (ordenados por `risk_score`); o estado "tudo sob controle" quando a base está
 * saudável; e um estado de **erro** quando a busca falhou (para não mascarar uma
 * falha como base saudável). Presentational — dados via props. O clique em
 * "Abrir" chama `onOpenClient` (stub até a rota de relatório do cliente, S3).
 */
export function ConsultantAttentionList({ clients = [], total = 0, base = 0, hasLoaded, error, onOpenClient }) {
  const hasError = !!error && clients.length === 0;
  const isEmpty = !hasError && hasLoaded && clients.length === 0;

  let pill;
  if (hasError) pill = <Badge color={T.inkLight} bg={T.grayLight}>indisponível</Badge>;
  else if (isEmpty) pill = <Badge color={T.green} bg={T.greenLight}>0 alertas</Badge>;
  else pill = <Badge color={T.red} bg={T.redLight}>{`${total}${base ? ` de ${base}` : ""}`}</Badge>;

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "15px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Precisam de atenção</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
            {hasError ? "Não foi possível carregar os clientes em risco" : isEmpty ? "Base monitorada em tempo real" : "Ordenados pela maior pontuação de risco"}
          </div>
        </div>
        {pill}
      </div>
      <div style={{ height: 1, background: T.border }} />
      {hasError ? (
        <AttentionMessage
          tone={{ color: T.red, bg: T.redLight, glyph: "!" }}
          title="Não foi possível carregar"
          text="Houve um erro ao buscar os clientes em risco. Tente atualizar em instantes."
        />
      ) : isEmpty ? (
        <AttentionMessage
          tone={{ color: T.green, bg: T.greenLight, glyph: "✓" }}
          title="Tudo sob controle"
          text="Nenhum cliente em risco no momento. Toda a base está com saúde financeira saudável."
        />
      ) : (
        clients.map((client) => (
          <AttentionItem key={client.organization_id} client={client} onOpenClient={onOpenClient} />
        ))
      )}
    </Card>
  );
}
