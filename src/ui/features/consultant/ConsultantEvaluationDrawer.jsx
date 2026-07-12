import React, { useEffect, useRef } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { AiChart } from "./AiChart.jsx";
import { fmtComputedAt, healthTone } from "./consultantFormat";
import { HealthRing, Icon } from "./consultantUi";
import { ERROR_INSUFFICIENT_DATA, useClientEvaluation } from "./useClientEvaluation.js";

/**
 * Drawer "Avaliar com IA" (Consultor IA — A1).
 *
 * Porte fiel do `AiDrawer` da referência canônica de design
 * (`consultor/cons-copiloto.jsx`, `kind="avaliar"`): painel lateral de 440px
 * com backdrop, cabeçalho roxo com o ícone `sparkles`, corpo com skeleton
 * shimmer enquanto carrega, e rodapé de ações.
 *
 * A referência renderiza blocos mock (`verdict` / `p` / `list`); aqui os mesmos
 * blocos são alimentados pelo `EvaluateClientOutput` real do backend:
 *
 *   verdict                    ← health_read
 *   p                          ← summary
 *   (novo) charts              ← charts[]  (o modelo emite ChartSpec, não imagem)
 *   list "Pontos de atenção"   ← watch_points[]
 *   list "Recomendações…"      ← action_plan[]
 *
 * Estado de erro **não existe na referência** (lá a resposta é mock e nunca
 * falha) — foi desenhado na mesma linguagem visual.
 */

const PRIORITY_META = {
  high: { label: "Alta", color: T.red, bg: T.redLight },
  medium: { label: "Média", color: T.amber, bg: T.amberLight },
  low: { label: "Baixa", color: T.inkMid, bg: T.grayLight },
};

const SECTION_LABEL = {
  ...G,
  fontSize: 11,
  fontWeight: 700,
  color: T.inkLight,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 7,
};

/** Bloco `verdict` da referência: anel de saúde + leitura do score. */
function VerdictBlock({ healthRead }) {
  const tone = healthTone(healthRead.score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: tone.bg, borderRadius: 10, padding: "12px 14px" }}>
      <HealthRing health={healthRead.score} size={42} stroke={4.5} />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: tone.color }}>{healthRead.headline}</div>
        {healthRead.label && (
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{healthRead.label}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Bloco `list` da referência: bullet roxo + texto.
 *
 * Cada `watch_point` é um objeto `{ metric, note }` (contrato `WatchPoint` em
 * `contracts.py`), não uma string — a `note` é o texto e a `metric` identifica
 * o indicador a acompanhar.
 */
function WatchPointList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={SECTION_LABEL}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((wp, i) => (
          <div key={wp.metric ?? i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: T.purple, marginTop: 7, flexShrink: 0 }} />
            <span style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.5 }}>
              {wp.note}
              {wp.metric && (
                <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkGhost, marginLeft: 6 }}>({wp.metric})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Plano de ação — mais rico que o `list` da referência, porque cada item traz
 * `rationale`, `priority` e as evidências que ancoram a recomendação nos dados
 * (grounding). A evidência é o que separa análise de chute, então ela aparece.
 */
function ActionPlan({ items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={SECTION_LABEL}>Recomendações priorizadas</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item, i) => {
          const p = PRIORITY_META[item.priority] || PRIORITY_META.low;
          return (
            <div key={i} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.ink, flex: 1, lineHeight: 1.4 }}>{item.title}</span>
                <span style={{ ...G, fontSize: 9.5, fontWeight: 800, color: p.color, background: p.bg, borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {p.label}
                </span>
              </div>
              {item.rationale && (
                <p style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.55, margin: "6px 0 0" }}>{item.rationale}</p>
              )}
              {item.evidence?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                  {item.evidence.map((e, j) => (
                    <span key={j} title={`Fonte: ${e.source_tool}`}
                      style={{ ...G, ...NUM, fontSize: 10, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 6, padding: "3px 7px" }}>
                      {e.metric}: {typeof e.value === "number" ? e.value.toLocaleString("pt-BR") : e.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Skeleton da referência: linha de status + 4 barras shimmer. */
function LoadingState({ firstName }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: T.purple, ...G, fontSize: 12.5, fontWeight: 600 }}>
        <span className="ai-spin" style={{ width: 15, height: 15, border: `2px solid ${T.purpleLight}`, borderTopColor: T.purple, borderRadius: 99, display: "inline-block" }} />
        Analisando dados {firstName ? `de ${firstName}` : "do cliente"}…
      </div>
      {[100, 78, 92, 60].map((w, i) => (
        <div key={i} className="ai-shimmer" style={{ height: 12, width: `${w}%`, borderRadius: 6, background: T.grayLight }} />
      ))}
    </div>
  );
}

/**
 * Cliente sem dado NÃO é um erro — é um estado do cliente.
 *
 * Pintá-lo de vermelho com "Tentar novamente" fazia o consultor retentar contra
 * um cliente vazio: nada mudaria, e antes do pre-check no backend cada tentativa
 * queimava uma run de LLM. A saída aqui é o consultor pedir lançamentos ao
 * cliente, não apertar um botão. Por isso: tom neutro, e sem retry.
 */
function InsufficientDataState({ firstName, message }) {
  return (
    <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="sparkles" size={15} color={T.purple} />
        <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.ink }}>
          Ainda não há dados para analisar
        </span>
      </div>
      <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.6, margin: 0 }}>{message}</p>
      <p style={{ ...G, fontSize: 11.5, color: T.inkGhost, lineHeight: 1.55, margin: "10px 0 0" }}>
        Combine com {firstName} o registro das primeiras receitas e despesas — a avaliação fica
        disponível assim que houver histórico.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="alert" size={15} color={T.red} />
        <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.red }}>Não foi possível avaliar</span>
      </div>
      <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.55, margin: "0 0 12px" }}>{message}</p>
      <button type="button" onClick={onRetry}
        style={{ ...G, fontSize: 12, fontWeight: 700, color: "#fff", background: T.ink, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
        Tentar novamente
      </button>
    </div>
  );
}

/**
 * Idade da avaliação + ação de recalcular.
 *
 * Nasceu do cache (que torna o segundo clique instantâneo e faria o consultor
 * duvidar se está vendo dado velho), mas hoje vale para QUALQUER avaliação: o
 * drawer sobrevive ao fechamento, então a análise na tela pode ter horas mesmo
 * sem ter vindo do cache. Amarrar a faixa a `cached` esconderia justamente o
 * caso pior — resultado velho, sem idade e sem botão de recalcular.
 *
 * Some quando `fmtComputedAt` não tem o que dizer: um rótulo "há —" seria pior
 * que rótulo nenhum.
 */
function EvaluationAgeNotice({ computedAt, onRefresh }) {
  const when = fmtComputedAt(computedAt);
  if (!when) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px",
    }}>
      <span style={{ ...G, fontSize: 11.5, color: T.inkLight }}>
        Avaliação de <strong style={{ color: T.inkMid, fontWeight: 700 }}>{when}</strong>
      </span>
      <button
        type="button"
        onClick={onRefresh}
        style={{
          ...G, fontSize: 11.5, fontWeight: 700, color: T.purple,
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0,
        }}
      >
        Recalcular
      </button>
    </div>
  );
}

/**
 * "O recálculo falhou, mas sua avaliação continua aqui."
 *
 * Só aparece quando um `refresh` falha COM um resultado preservado na tela. É
 * deliberadamente um aviso, não a `ErrorState`: bloquear a tela apagaria uma
 * análise boa por causa de uma run que não vingou.
 */
function RefreshFailedNotice({ message, onRetry }) {
  return (
    <div style={{ background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="alert" size={14} color={T.red} />
        <span style={{ ...G, fontSize: 11.5, fontWeight: 700, color: T.red, flex: 1 }}>
          Não foi possível recalcular
        </span>
        <button type="button" onClick={onRetry}
          style={{ ...G, fontSize: 11.5, fontWeight: 700, color: T.red, background: "transparent", border: "none",
            padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}>
          Tentar de novo
        </button>
      </div>
      <p style={{ ...G, fontSize: 11.5, color: T.inkMid, lineHeight: 1.5, margin: "5px 0 0" }}>
        {message} Você continua vendo a avaliação anterior.
      </p>
    </div>
  );
}

/** Botão de rodapé desabilitado — Trilha B (fora do escopo do A1). */
function SoonButton({ icon, children }) {
  return (
    <button type="button" disabled title={`${children} (em breve)`}
      style={{ ...G, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "6px 11px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface,
        color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "default", opacity: 0.6 }}>
      <Icon name={icon} size={12} color={T.inkMid} /> {children}
    </button>
  );
}

export function ConsultantEvaluationDrawer({ open, organizationId, clientName, onClose }) {
  const { loading, error, errorCode, result, correlationId, computedAt, run, refresh, reset } =
    useClientEvaluation(organizationId);
  const startedFor = useRef(null);

  // Dispara a avaliação ao abrir. Só uma vez por cliente: reabrir o drawer
  // mostra a run já existente — em voo ou pronta — em vez de disparar outra.
  // O `startedFor` só cumpre esse papel porque o drawer NÃO é mais desmontado ao
  // fechar; antes ele nascia zerado a cada abertura e o "reabrir" pagava uma
  // segunda avaliação em paralelo com a primeira.
  useEffect(() => {
    if (!open || !organizationId) return;
    if (startedFor.current === organizationId) return;
    startedFor.current = organizationId;
    run();
  }, [open, organizationId, run]);

  // Fecha no Escape: o painel se anuncia como `aria-modal`, então precisa ser
  // dispensável pelo teclado — no mobile ele ocupa 92vw e prende a navegação.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // `run()` direto, sem tocar em `startedFor`: o guard protege só o efeito de
  // auto-run, e aqui a intenção do consultor é explícita.
  const retry = () => {
    reset();
    run();
  };

  if (!open) return null;

  const firstName = clientName ? clientName.split(" ")[0] : "";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}
      role="dialog" aria-modal="true" aria-label="Avaliação com IA">
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,15,13,0.32)", animation: "fadeIn 0.2s ease" }} />

      <div style={{ position: "relative", width: 440, maxWidth: "92vw", height: "100%", background: T.surface, boxShadow: T.xl, display: "flex", flexDirection: "column", animation: "slideInPanel 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        {/* Cabeçalho */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="sparkles" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Avaliação por IA</div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {clientName || "Cliente"}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={15} color={T.inkMid} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && <LoadingState firstName={firstName} />}
          {/* As telas de erro são exclusivas: só tomam o corpo quando NÃO há uma
              avaliação preservada. Com resultado em tela, o erro vira aviso. */}
          {!loading && error && !result && errorCode === ERROR_INSUFFICIENT_DATA && (
            <InsufficientDataState firstName={firstName} message={error} />
          )}
          {!loading && error && !result && errorCode !== ERROR_INSUFFICIENT_DATA && (
            <ErrorState message={error} onRetry={retry} />
          )}
          {!loading && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <RefreshFailedNotice message={error} onRetry={refresh} />}

              <EvaluationAgeNotice computedAt={computedAt} onRefresh={refresh} />

              <VerdictBlock healthRead={result.health_read} />

              <p style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.65, margin: 0 }}>{result.summary}</p>

              {result.charts?.map((spec, i) => <AiChart key={i} spec={spec} />)}

              <WatchPointList title="Pontos de atenção" items={result.watch_points} />

              <ActionPlan items={result.action_plan} />

              {result.disclaimers?.length > 0 && (
                <div style={{ ...G, fontSize: 10, color: T.inkGhost, lineHeight: 1.5, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  {result.disclaimers.join(" · ")}
                </div>
              )}

              {correlationId && (
                <div style={{ ...G, fontSize: 9.5, color: T.inkGhost }}>
                  ID da análise: <span style={{ ...NUM }}>{correlationId}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé — ações da Trilha B, ainda stubs */}
        {!loading && result && (
          <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
            <SoonButton icon="download">Exportar</SoonButton>
            <SoonButton icon="message">Enviar ao cliente</SoonButton>
          </div>
        )}
      </div>
    </div>
  );
}
