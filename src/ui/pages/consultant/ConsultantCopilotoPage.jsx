import React, { useMemo, useRef, useState, useEffect } from "react";

import { Card, PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Avatar, Icon } from "../../features/consultant/consultantUi";
import { AiChart } from "../../features/consultant/AiChart.jsx";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { useCopiloto } from "../../features/consultant/useCopiloto.js";
import { useCanUseCopilotoAi } from "../../features/consultant/consultantAiAccess.js";
import { useEvaluationDrawer } from "../../features/consultant/useEvaluationDrawer.js";
import { ConsultantEvaluationDrawer } from "../../features/consultant/ConsultantEvaluationDrawer.jsx";

/**
 * Copiloto IA (Consultor IA — A4): o chat escopado à carteira do consultor.
 *
 * Construído contra a referência canônica `consultor/cons-copiloto.jsx`
 * (`CopilotoPage`): cabeçalho + seletor de escopo, uma área de mensagens (estado
 * vazio com quick-prompts ou a conversa), e um composer. O que a referência mocka
 * — a "resposta da IA" — aqui vem do backend real (`CopilotoOutput`), renderizado
 * por `AnswerRenderer`.
 *
 * Três coisas que só o chat tem, e que moram fora deste componente:
 * - multi-turno (o `sessionId` do `copilotoStore`, reenviado a cada mensagem);
 * - o filtro por nome ancorado (o seletor de escopo injeta o nome do cliente na
 *   mensagem — decisão de PII do A4);
 * - nenhuma falha destrói a conversa (bolha de erro anexada, no store).
 */

function Kicker({ children }) {
  return (
    <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {children}
    </div>
  );
}

const QUICK_PROMPTS = [
  { ic: "alert", t: "Quais clientes estão em risco e por quê?" },
  { ic: "up", t: "Quem está pronto para começar a investir?" },
  { ic: "file", t: "Gere um resumo executivo da minha base" },
  { ic: "card", t: "Onde meus clientes mais gastam no agregado?" },
];

// ── Renderização do markdown do `answer` ────────────────────────────────────
// O backend devolve markdown leve (negrito, listas). Sem dependência de um parser
// externo, cobrimos o que o modelo realmente emite: **negrito**, linhas de bullet
// (`- `) e quebras de parágrafo. É deliberadamente conservador — texto que não
// casa um padrão sai como texto puro, nunca como HTML cru.

function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b${i}`} style={{ fontWeight: 700, color: T.ink }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>;
  });
}

function Markdown({ text }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        const isList = lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <div key={`bl${bi}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {lines.map((line, li) => (
                <div key={`li${li}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: T.purple, marginTop: 8, flexShrink: 0 }} />
                  <span style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.55 }}>
                    {renderInline(line.replace(/^\s*[-*]\s+/, ""), `l${bi}-${li}`)}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <p key={`bl${bi}`} style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.65, margin: 0 }}>
            {lines.map((line, li) => (
              <React.Fragment key={`p${li}`}>
                {li > 0 && <br />}
                {renderInline(line, `p${bi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ── Renderizador de uma resposta do Copiloto (CopilotoOutput) ────────────────

function ClientRefChip({ block, onOpenClient }) {
  const clickable = typeof onOpenClient === "function";
  return (
    <button
      type="button"
      onClick={clickable ? () => onOpenClient(block.organization_id, block.client_name) : undefined}
      disabled={!clickable}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 99, padding: "4px 11px 4px 5px", cursor: clickable ? "pointer" : "default" }}
    >
      <Avatar name={block.client_name} size={20} />
      <span style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>{block.client_name}</span>
      {clickable && <Icon name="arrow-right" size={12} color={T.inkLight} />}
    </button>
  );
}

function AnswerRenderer({ output, onOpenClient, onEvaluate }) {
  // Defesa: um `output` ausente (violação de contrato do backend — 200/ok sem
  // corpo) não pode virar o crash "Objects are not valid as a React child" que
  // já mordeu o drawer da A1. Falha suave em vez de derrubar a conversa toda.
  if (!output) return null;
  const clientRefs = (output.blocks || []).filter((b) => b.type === "client_ref");
  const charts = (output.blocks || []).filter((b) => b.type === "chart");
  const actions = output.suggested_actions || [];
  const disclaimers = output.disclaimers || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Markdown text={output.answer} />

      {charts.map((block, i) => (
        <AiChart key={`chart${i}`} spec={block.spec} />
      ))}

      {clientRefs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {clientRefs.map((block, i) => (
            <ClientRefChip key={`ref${i}`} block={block} onOpenClient={onOpenClient} />
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actions.map((action, i) => (
            <button
              key={`act${i}`}
              type="button"
              onClick={() => onEvaluate?.(action.organization_id, action.label)}
              style={{ ...G, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 9, border: "none", background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              <Icon name="sparkles" size={13} color="#fff" /> {action.label}
            </button>
          ))}
        </div>
      )}

      {disclaimers.length > 0 && (
        <div style={{ ...G, fontSize: 11, color: T.inkGhost, lineHeight: 1.5, borderTop: `1px solid ${T.border}`, paddingTop: 9 }}>
          {disclaimers.map((d, i) => (
            <div key={`disc${i}`}>{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Teaser de upgrade (plano sem consultant_ai) ─────────────────────────────

function CopilotoProTeaser() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Kicker>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name="sparkles" size={12} color={T.purple} /> Assistente escopado à sua carteira
          </span>
        </Kicker>
        <PageTitle sans="Copiloto" serif="IA" />
      </div>
      <Card style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="sparkles" size={15} color="#fff" />
          </div>
          <span style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Copiloto IA</span>
          <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: "#fff", border: "1px solid #E6DEFB", borderRadius: 99, padding: "2px 7px", marginLeft: "auto" }}>PRO</span>
        </div>
        <div style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.6 }}>
          Converse com a IA sobre toda a sua base: quem precisa de atenção e por quê, quem está pronto
          para investir, onde a carteira gasta. As respostas vêm ancoradas nos dados reais dos seus
          clientes. Disponível no plano Pro.
        </div>
      </Card>
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export function ConsultantCopilotoPage() {
  const canUse = useCanUseCopilotoAi();
  const { messages, sending, banner, send, startNew } = useCopiloto();
  const { clients } = useConsultantClients({ enabled: canUse });
  const evaluation = useEvaluationDrawer();

  const [input, setInput] = useState("");
  const [scopeId, setScopeId] = useState("");
  const scrollRef = useRef(null);

  const clientById = useMemo(
    () => Object.fromEntries((clients || []).map((c) => [c.organization_id, c])),
    [clients]
  );
  const scopeClient = scopeId ? clientById[scopeId] : null;
  const scopeName = scopeClient?.client_name || "";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  if (!canUse) return <CopilotoProTeaser />;

  const ask = (text) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setInput("");
    send(q, { scopeClientName: scopeName });
  };

  // Resolve o nome REAL do cliente pela carteira (o consultor vê nomes completos
  // dos próprios clientes), nunca confiando na string que o chamador passou: um
  // `suggested_action` traz o RÓTULO do botão ("Avaliar Ana com IA"), não o nome
  // — usá-lo como `client_name` abriria o drawer da A1 com o cabeçalho errado e
  // saudando "Avaliar". O `organization_id` é sempre a fonte de verdade.
  const openClientEval = (organizationId, fallbackName) => {
    const clientName = clientById[organizationId]?.client_name || fallbackName || "Cliente";
    evaluation.openFor({ organization_id: organizationId, client_name: clientName });
  };

  const empty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <Kicker>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="sparkles" size={12} color={T.purple} /> Assistente escopado à sua carteira
            </span>
          </Kicker>
          <PageTitle sans="Copiloto" serif="IA" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!empty && (
            <button type="button" onClick={startNew}
              style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Icon name="plus" size={13} color={T.inkMid} /> Nova conversa
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 8px 6px 12px" }}>
            <span style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkLight }}>Escopo:</span>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              aria-label="Escopo da conversa"
              style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink, border: "none", background: T.bg, borderRadius: 7, padding: "6px 9px", cursor: "pointer", outline: "none" }}
            >
              <option value="">Toda a base</option>
              {(clients || []).map((c) => (
                <option key={c.organization_id} value={c.organization_id}>{c.client_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {banner && (
        <div style={{ ...G, fontSize: 12.5, color: T.red, background: "#FEECEC", border: "1px solid #F7C9C9", borderRadius: 10, padding: "10px 14px" }}>
          {banner.message}
        </div>
      )}

      <Card style={{ flex: 1, minHeight: 480, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: empty ? 0 : 22 }}>
          {empty ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, background: `linear-gradient(135deg, ${T.purple}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon name="sparkles" size={26} color="#fff" />
              </div>
              <div style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 6 }}>Como posso ajudar com sua carteira?</div>
              <div style={{ ...G, fontSize: 13, color: T.inkLight, maxWidth: 420, lineHeight: 1.6, marginBottom: 22 }}>
                Pergunte sobre o conjunto dos seus clientes ou foque em um específico pelo escopo acima. A IA enxerga apenas a sua base.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", maxWidth: 460 }}>
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} type="button" onClick={() => ask(p.t)}
                    style={{ ...G, display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderRadius: 11, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name={p.ic} size={14} color={T.purple} />
                    </div>
                    <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, flex: 1 }}>{p.t}</span>
                    <Icon name="arrow-right" size={14} color={T.inkGhost} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ ...G, fontSize: 13, lineHeight: 1.5, padding: "10px 14px", borderRadius: 14, borderBottomRightRadius: 4, background: T.ink, color: "#fff", maxWidth: "78%" }}>{m.text}</div>
                  </div>
                ) : (
                  <div key={m.id} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="sparkles" size={15} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, borderTopLeftRadius: 4, padding: "15px 16px" }}>
                      {m.error ? (
                        <div style={{ ...G, fontSize: 13, color: T.red, lineHeight: 1.55 }}>{m.error}</div>
                      ) : (
                        <AnswerRenderer output={m.output} onOpenClient={openClientEval} onEvaluate={openClientEval} />
                      )}
                    </div>
                  </div>
                )
              )}
              {sending && (
                <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="sparkles" size={15} color="#fff" />
                  </div>
                  <div style={{ ...G, fontSize: 12.5, color: T.inkLight, fontWeight: 600 }}>Analisando sua base…</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 18px", background: T.surface }}>
          {scopeClient && (
            <div style={{ marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 7, background: T.purpleLight, borderRadius: 99, padding: "4px 10px 4px 6px" }}>
              <Avatar name={scopeName} size={20} />
              <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.purple }}>Focado em {scopeName}</span>
              <button type="button" onClick={() => setScopeId("")} aria-label="Remover foco" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                <Icon name="x" size={12} color={T.purple} />
              </button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 13, padding: "5px 6px 5px 15px" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
              disabled={sending}
              placeholder={scopeName ? `Pergunte sobre ${scopeName}…` : "Pergunte algo sobre sua carteira…"}
              aria-label="Mensagem para o Copiloto"
              style={{ ...G, flex: 1, border: "none", outline: "none", fontSize: 13.5, color: T.ink, background: "transparent", padding: "9px 0" }}
            />
            <button
              type="button"
              onClick={() => ask()}
              disabled={sending || !input.trim()}
              aria-label="Enviar mensagem"
              style={{ background: input.trim() && !sending ? T.purple : T.grayLight, border: "none", borderRadius: 10, padding: "10px 12px", cursor: input.trim() && !sending ? "pointer" : "default", display: "flex" }}
            >
              <Icon name="send" size={16} color={input.trim() && !sending ? "#fff" : T.inkGhost} />
            </button>
          </div>
          <div style={{ ...G, fontSize: 10, color: T.inkGhost, marginTop: 8, textAlign: "center" }}>
            A IA acessa somente dados da sua carteira · respostas podem conter imprecisões
          </div>
        </div>
      </Card>

      {evaluation.target && (
        <ConsultantEvaluationDrawer
          open
          organizationId={evaluation.target.organizationId}
          clientName={evaluation.target.clientName}
          onClose={evaluation.close}
        />
      )}
    </div>
  );
}
