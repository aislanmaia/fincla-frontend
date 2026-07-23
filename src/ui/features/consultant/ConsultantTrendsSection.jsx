import React, { useEffect } from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { fmtComputedAt } from "./consultantFormat";
import { Icon } from "./consultantUi";
import { ERROR_INSUFFICIENT_DATA, usePortfolioTrends } from "./usePortfolioTrends.js";

/**
 * "Tendências detectadas pela IA" (Consultor IA — A3) — a única seção de IA da
 * tela de Insights. Porte do bloco `IA trends` da referência
 * (`consultor/cons-insights.jsx`): card roxo com cabeçalho `sparkles` + grade de
 * cards, um por tendência.
 *
 * A diferença de gatilho vs o card do A2: esta seção **auto-dispara** a geração
 * ao montar. É viável porque o backend cacheia por 1 dia — a 1ª visita do dia
 * paga, o resto é cache hit. O auto-run é idempotente (ver `portfolioTrendsStore`):
 * o StrictMode dobra o efeito mas dispara UMA requisição, reabrir a tela
 * reencontra em vez de pagar, e um ERRO não re-dispara sozinho (só o "Atualizar").
 */

// tom → cor + ícone. Fechado: o backend valida `tone` contra o mesmo conjunto.
const TONE_META = {
  risk: { color: T.red, icon: "alert" },
  opportunity: { color: T.green, icon: "up" },
  watch: { color: T.amber, icon: "flag" },
};

const CARD_STYLE = {
  padding: 20,
  background: `linear-gradient(160deg, ${T.purpleLight}, ${T.surface} 60%)`,
  borderColor: "#E6DEFB",
};

function Header({ computedAt, onRefresh, refreshing }) {
  const when = fmtComputedAt(computedAt);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="sparkles" size={15} color="#fff" />
      </div>
      <span style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Tendências detectadas pela IA</span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {when && <span style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{when}</span>}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Atualizar tendências"
            style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: "1px solid #E6DEFB", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: T.purple, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1 }}
          >
            <Icon name="refresh" size={12} color={T.purple} /> Atualizar
          </button>
        )}
      </div>
    </div>
  );
}

function TrendCard({ trend }) {
  const meta = TONE_META[trend.tone] || TONE_META.watch;
  return (
    <div style={{ background: "#fff", border: "1px solid #EDE7FB", borderRadius: 12, padding: 15 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon name={meta.icon} size={15} color={meta.color} />
      </div>
      <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 6, lineHeight: 1.3 }}>{trend.title}</div>
      <div style={{ ...G, fontSize: 11.5, color: T.inkMid, lineHeight: 1.55 }}>{trend.description}</div>
    </div>
  );
}

/** Grade responsiva: cai de 3 para menos colunas conforme a largura e a contagem. */
function TrendGrid({ trends }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
      {trends.map((t, i) => (
        <TrendCard key={i} trend={t} />
      ))}
    </div>
  );
}

/** Skeleton: 3 cards shimmer enquanto a IA lê a base. */
function LoadingGrid() {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: T.purple, ...G, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
        <span className="ai-spin" style={{ width: 14, height: 14, border: `2px solid ${T.purpleLight}`, borderTopColor: T.purple, borderRadius: 99, display: "inline-block" }} />
        Lendo os números de toda a carteira…
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #EDE7FB", borderRadius: 12, padding: 15 }}>
            <div className="ai-shimmer" style={{ width: 28, height: 28, borderRadius: 8, background: T.grayLight, marginBottom: 10 }} />
            <div className="ai-shimmer" style={{ height: 12, width: "70%", borderRadius: 6, background: T.grayLight, marginBottom: 8 }} />
            <div className="ai-shimmer" style={{ height: 9, width: "95%", borderRadius: 6, background: T.grayLight, marginBottom: 5 }} />
            <div className="ai-shimmer" style={{ height: 9, width: "80%", borderRadius: 6, background: T.grayLight }} />
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyBookState({ message, onAddClient }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.purple}22`, borderRadius: 10, padding: "16px 18px" }}>
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
    <div style={{ background: "#fff", border: `1px solid ${T.red}22`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="alert" size={15} color={T.red} />
        <span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.red }}>Não foi possível detectar tendências</span>
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
 * Versão trancada da seção (plano sem `consultant_ai`). NÃO usa o hook — a seção
 * real auto-dispara, e um consultor sem o recurso não deve nem tocar a API.
 * Convite de upgrade no lugar, na mesma linguagem visual.
 */
export function ConsultantTrendsProTeaser() {
  return (
    <Card style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="sparkles" size={15} color="#fff" />
        </div>
        <span style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Tendências detectadas pela IA</span>
        <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: "#fff", border: "1px solid #E6DEFB", borderRadius: 99, padding: "2px 7px", marginLeft: "auto" }}>PRO</span>
      </div>
      <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}>
        A IA cruza os números de toda a carteira e aponta padrões — concentração de risco, janelas
        para investimento, categorias que corroem a base — com ações sugeridas. Disponível no plano Pro.
      </div>
    </Card>
  );
}

export function ConsultantTrendsSection({ onAddClient }) {
  const { loading, error, errorCode, result, computedAt, run, refresh, reset } = usePortfolioTrends();

  // Auto-dispara ao montar. Idempotente por carteira: o StrictMode dobra o efeito
  // mas dispara UMA requisição, e reabrir a tela reencontra a run em vez de pagar.
  useEffect(() => {
    run();
  }, [run]);

  const retry = () => {
    reset();
    run();
  };

  return (
    <Card style={CARD_STYLE}>
      <Header
        computedAt={result ? computedAt : null}
        onRefresh={result ? refresh : null}
        refreshing={loading}
      />

      {loading && <LoadingGrid />}

      {!loading && error && !result && errorCode === ERROR_INSUFFICIENT_DATA && (
        <EmptyBookState message={error} onAddClient={onAddClient} />
      )}
      {!loading && error && !result && errorCode !== ERROR_INSUFFICIENT_DATA && (
        <ErrorState message={error} onRetry={retry} />
      )}

      {!loading && result && (
        <>
          {/* Um refresh que falhou preserva o resultado; avisa sem bloquear. */}
          {error && (
            <div style={{ ...G, fontSize: 11, color: T.red, marginBottom: 10 }}>
              Não foi possível atualizar — você está vendo as tendências anteriores.
            </div>
          )}
          <TrendGrid trends={result.trends} />
          {result.disclaimers?.length > 0 && (
            <div style={{ ...G, fontSize: 10, color: T.inkGhost, lineHeight: 1.5, marginTop: 14 }}>
              {result.disclaimers.join(" · ")}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
