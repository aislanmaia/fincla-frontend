import React, { useEffect } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { AiChart } from "./AiChart.jsx";
import { fmtComputedAt } from "./consultantFormat";
import { Icon } from "./consultantUi";
import { ERROR_INSUFFICIENT_DATA, usePortfolioSummary } from "./usePortfolioSummary.js";

/**
 * Drawer "Resumo da base por IA" (Consultor IA — A2).
 *
 * Irmão do `ConsultantEvaluationDrawer` (A1), portado do mesmo `AiDrawer` da
 * referência canônica (`consultor/cons-copiloto.jsx`, `kind="base"` →
 * "Relatório da base"): painel de 440px, backdrop, cabeçalho roxo `sparkles`,
 * skeleton shimmer, rodapé de ações. A diferença é o CONTRATO renderizado —
 * aqui `PortfolioSummaryOutput`, sobre a carteira inteira:
 *
 *   PortfolioReadCard          ← portfolio_read  (os números da base + cobertura)
 *   p                          ← summary
 *   charts                     ← charts[]
 *   PriorityList               ← priorities[]    (clientes que precisam de atenção)
 *   OpportunityList            ← opportunities[] (ações sobre o conjunto)
 *
 * `onOpenClient` (opcional) recebe o `organization_id` de uma prioridade — é o que
 * faz o card do Painel LINKAR para o cliente. Sem ele, os nomes viram texto morto.
 */

const SECTION_LABEL = {
  ...G,
  fontSize: 11,
  fontWeight: 700,
  color: T.inkLight,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 7,
};

/** Uma célula de número da carteira. `avg_health` null vira "—", nunca 0. */
function ReadStat({ label, value, tone }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 12px" }}>
      <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 800, color: tone || T.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/**
 * Os números da base. `clients_pending > 0` é dito EXPLICITAMENTE: a média não
 * fala pela base toda, e esconder isso apresentaria a saúde de 3 clientes como a
 * saúde de 200. `avg_health` null é ausência (ninguém pontuado), não zero.
 */
function PortfolioReadCard({ read }) {
  if (!read) return null;
  const hasScore = read.avg_health != null;
  const pending = read.clients_pending > 0;
  return (
    <div>
      <div style={SECTION_LABEL}>Números da base</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ReadStat label="Clientes" value={read.client_count.toLocaleString("pt-BR")} />
        <ReadStat
          label="Saúde média"
          value={hasScore ? read.avg_health.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
          tone={hasScore ? undefined : T.inkGhost}
        />
        <ReadStat label="Avaliados" value={read.clients_scored.toLocaleString("pt-BR")} />
        <ReadStat label="Em risco" value={read.at_risk_count.toLocaleString("pt-BR")} tone={read.at_risk_count > 0 ? T.red : undefined} />
      </div>
      {pending && (
        <p style={{ ...G, fontSize: 11, color: T.inkGhost, lineHeight: 1.5, margin: "8px 0 0" }}>
          {read.clients_pending.toLocaleString("pt-BR")} cliente{read.clients_pending > 1 ? "s" : ""} ainda sem saúde calculada —
          a média não fala por {read.clients_pending > 1 ? "eles" : "ele"}.
        </p>
      )}
    </div>
  );
}

/** Chips de evidência, iguais aos do plano de ação do A1 (grounding visível). */
function EvidenceChips({ evidence }) {
  if (!evidence?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {evidence.map((e, j) => (
        <span key={j} title={`Fonte: ${e.source_tool}`}
          style={{ ...G, ...NUM, fontSize: 10, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 6, padding: "3px 7px" }}>
          {e.metric}: {typeof e.value === "number" ? e.value.toLocaleString("pt-BR") : String(e.value)}
        </span>
      ))}
    </div>
  );
}

/**
 * Clientes que precisam de atenção. Cada um é clicável se `onOpenClient` existir —
 * o `organization_id` é o que liga o nome minimizado ("Ana P.") ao cliente real.
 */
function PriorityList({ items, onOpenClient }) {
  if (!items?.length) return null;
  const clickable = typeof onOpenClient === "function";
  return (
    <div>
      <div style={SECTION_LABEL}>Prioridades da semana</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((p, i) => (
          <div
            key={p.organization_id ?? i}
            onClick={clickable ? () => onOpenClient(p.organization_id) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenClient(p.organization_id); } } : undefined}
            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", cursor: clickable ? "pointer" : "default" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: T.red, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.ink, flex: 1, minWidth: 0 }}>{p.client_name}</span>
              {clickable && <Icon name="arrow-right" size={13} color={T.inkGhost} />}
            </div>
            {p.note && (
              <p style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.55, margin: "6px 0 0" }}>{p.note}</p>
            )}
            <EvidenceChips evidence={p.evidence} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Oportunidades — ações sobre o CONJUNTO, bullet verde. */
function OpportunityList({ items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div style={SECTION_LABEL}>Oportunidades</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((o, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green, marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.5 }}>{o.note}</span>
              <EvidenceChips evidence={o.evidence} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton — igual ao A1, mas o texto fala da base, não de um cliente. */
function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: T.purple, ...G, fontSize: 12.5, fontWeight: 600 }}>
        <span className="ai-spin" style={{ width: 15, height: 15, border: `2px solid ${T.purpleLight}`, borderTopColor: T.purple, borderRadius: 99, display: "inline-block" }} />
        Lendo os números de toda a sua carteira…
      </div>
      {[100, 78, 92, 60].map((w, i) => (
        <div key={i} className="ai-shimmer" style={{ height: 12, width: `${w}%`, borderRadius: 6, background: T.grayLight }} />
      ))}
    </div>
  );
}

/**
 * Carteira sem clientes NÃO é erro — é um estado da conta. Tom neutro, sem retry:
 * a saída é adicionar clientes, não apertar um botão. Espelha o
 * `InsufficientDataState` do A1.
 */
function EmptyBookState({ message, onAddClient }) {
  return (
    <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="sparkles" size={15} color={T.purple} />
        <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.ink }}>Ainda não há carteira para analisar</span>
      </div>
      <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.6, margin: 0 }}>{message}</p>
      {typeof onAddClient === "function" && (
        <button type="button" onClick={onAddClient}
          style={{ ...G, marginTop: 12, fontSize: 12, fontWeight: 700, color: "#fff", background: T.purple, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={12} color="#fff" /> Adicionar cliente
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="alert" size={15} color={T.red} />
        <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.red }}>Não foi possível gerar o relatório</span>
      </div>
      <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.55, margin: "0 0 12px" }}>{message}</p>
      <button type="button" onClick={onRetry}
        style={{ ...G, fontSize: 12, fontWeight: 700, color: "#fff", background: T.ink, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
        Tentar novamente
      </button>
    </div>
  );
}

/** Idade + recalcular — mesma faixa do A1, para o consultor não ver dado velho como novo. */
function ReportAgeNotice({ computedAt, onRefresh }) {
  const when = fmtComputedAt(computedAt);
  if (!when) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ ...G, fontSize: 11.5, color: T.inkLight }}>
        Relatório de <strong style={{ color: T.inkMid, fontWeight: 700 }}>{when}</strong>
      </span>
      <button type="button" onClick={onRefresh}
        style={{ ...G, fontSize: 11.5, fontWeight: 700, color: T.purple, background: "transparent", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}>
        Recalcular
      </button>
    </div>
  );
}

/** Aviso de recálculo falho, preservando o relatório na tela. Espelha o A1. */
function RefreshFailedNotice({ message, onRetry }) {
  return (
    <div style={{ background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="alert" size={14} color={T.red} />
        <span style={{ ...G, fontSize: 11.5, fontWeight: 700, color: T.red, flex: 1 }}>Não foi possível recalcular</span>
        <button type="button" onClick={onRetry}
          style={{ ...G, fontSize: 11.5, fontWeight: 700, color: T.red, background: "transparent", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}>
          Tentar de novo
        </button>
      </div>
      <p style={{ ...G, fontSize: 11.5, color: T.inkMid, lineHeight: 1.5, margin: "5px 0 0" }}>
        {message} Você continua vendo o relatório anterior.
      </p>
    </div>
  );
}

/** Botão de rodapé desabilitado — Trilha B / Copiloto (fora do escopo do A2). */
function SoonButton({ icon, children }) {
  return (
    <button type="button" disabled title={`${children} (em breve)`}
      style={{ ...G, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "6px 11px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "default", opacity: 0.6 }}>
      <Icon name={icon} size={12} color={T.inkMid} /> {children}
    </button>
  );
}

export function ConsultantBaseSummaryDrawer({ open, onClose, onOpenClient, onAddClient }) {
  const { loading, error, errorCode, result, correlationId, computedAt, run, refresh, reset } =
    usePortfolioSummary();

  // Idempotente por carteira (ver `portfolioSummaryStore`): reabrir o drawer
  // reencontra a run — em voo ou pronta — em vez de pagar outra.
  useEffect(() => {
    if (!open) return;
    run();
  }, [open, run]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const retry = () => {
    reset();
    run();
  };

  // Linkar para um cliente fecha o drawer antes de navegar: o relatório fica no
  // store (sobrevive), e deixar o drawer aberto por cima da navegação prenderia a
  // tela de destino atrás do backdrop.
  const openClient = onOpenClient
    ? (organizationId) => {
        if (!organizationId) return;
        onClose?.();
        onOpenClient(organizationId);
      }
    : undefined;

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}
      role="dialog" aria-modal="true" aria-label="Resumo da base por IA">
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,15,13,0.32)", animation: "fadeIn 0.2s ease" }} />

      <div style={{ position: "relative", width: 440, maxWidth: "92vw", height: "100%", background: T.surface, boxShadow: T.xl, display: "flex", flexDirection: "column", animation: "slideInPanel 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
        {/* Cabeçalho */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="sparkles" size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Resumo da base por IA</div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight }}>Carteira completa</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}>
            <Icon name="x" size={15} color={T.inkMid} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && <LoadingState />}
          {!loading && error && !result && errorCode === ERROR_INSUFFICIENT_DATA && (
            <EmptyBookState message={error} onAddClient={onAddClient} />
          )}
          {!loading && error && !result && errorCode !== ERROR_INSUFFICIENT_DATA && (
            <ErrorState message={error} onRetry={retry} />
          )}
          {!loading && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && <RefreshFailedNotice message={error} onRetry={refresh} />}

              <ReportAgeNotice computedAt={computedAt} onRefresh={refresh} />

              <p style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.65, margin: 0 }}>{result.summary}</p>

              <PortfolioReadCard read={result.portfolio_read} />

              {result.charts?.map((spec, i) => <AiChart key={i} spec={spec} />)}

              <PriorityList items={result.priorities} onOpenClient={openClient} />

              <OpportunityList items={result.opportunities} />

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

        {/* Rodapé — ações da Trilha B / Copiloto, ainda stubs */}
        {!loading && result && (
          <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
            <SoonButton icon="download">Exportar</SoonButton>
            <SoonButton icon="sparkles">Abrir no Copiloto</SoonButton>
          </div>
        )}
      </div>
    </div>
  );
}
