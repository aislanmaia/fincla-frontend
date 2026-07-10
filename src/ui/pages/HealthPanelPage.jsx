import React from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, Card, PageEnter } from "../components/primitives";
import { useFinancialHealthData } from "../features/health/useFinancialHealthData.js";
import { shouldUseRealData } from "../dataMode.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const pct = (v) => `${Math.round(Number(v || 0) * 100)}%`;
const cap = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight };

const MOCK = {
  reference_month: "2026-06-01", ativo: 8500, passivo: 1200, patrimonio_liquido: 7300,
  avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42, cash_flow_risk: "low", score: 72,
};

function scoreBand(s) {
  if (s >= 70) return { color: T.green, bg: T.greenLight, label: "Boa saúde" };
  if (s >= 40) return { color: T.amber, bg: T.amberLight, label: "Atenção" };
  return { color: T.red, bg: T.redLight, label: "Em risco" };
}
function riskBadge(r) {
  if (r === "high") return { color: T.red, bg: T.redLight, label: "Fluxo em risco" };
  if (r === "medium") return { color: T.amber, bg: T.amberLight, label: "Atenção no fluxo" };
  return { color: T.green, bg: T.greenLight, label: "Fluxo saudável" };
}
function commitColor(c) {
  if (c <= 0.6) return T.green;
  if (c <= 0.8) return T.amber;
  return T.red;
}

function ScoreRing({ score }) {
  const band = scoreBand(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div style={{ position: "relative", width: 132, height: 132, flex: "0 0 auto" }}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} fill="none" stroke={T.grayLight} strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke={band.color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 66 66)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ ...G, ...NUM, fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: band.color, lineHeight: 1 }}>{score}</span>
        <span style={{ ...G, fontSize: 11, color: T.inkLight, fontWeight: 600 }}>de 100</span>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 170, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", background: T.surface }}>
      <div style={cap}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: color || T.ink, marginTop: 5 }}>{value}</div>
      {sub ? <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

/** M7 — Painel de Saúde Financeira. Sub-área "health" do hub. */
export function HealthPanelPage({ organizationId = null, dataMode = "live", isMobile = false }) {
  const live = shouldUseRealData(organizationId, dataMode);
  const { data: liveData, loading, error, insufficientData } = useFinancialHealthData({
    organizationId,
    enabled: live,
  });
  const data = live ? liveData : MOCK;

  const band = data ? scoreBand(data.score) : null;
  const risk = data ? riskBadge(data.cash_flow_risk) : null;

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Saúde Financeira</div>
      <PageTitle sans="Saúde" serif="Financeira" />

      {/* Conta sem transação nenhuma não é falha: é uma conta nova. Pintá-la de
          vermelho diria ao usuário que algo quebrou quando nada quebrou. */}
      {live && error ? (
        <div
          style={{
            ...G, fontSize: 12, borderRadius: 9, padding: "9px 12px", marginTop: 12,
            color: insufficientData ? T.inkMid : T.red,
            background: insufficientData ? T.grayLight : T.redLight,
          }}
        >
          {error}
        </div>
      ) : null}
      {live && loading && !data ? (
        <div style={{ ...G, fontSize: 13, color: T.inkLight, padding: "24px 4px" }}>Calculando sua saúde financeira…</div>
      ) : null}

      {data ? (
        <>
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            {/* Score */}
            <Card style={{ flex: "1 1 340px", padding: 18, display: "flex", alignItems: "center", gap: 18 }}>
              <ScoreRing score={data.score} />
              <div style={{ minWidth: 0 }}>
                <div style={cap}>Score de saúde</div>
                <div style={{ ...G, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: band.color, marginTop: 3 }}>{band.label}</div>
                <span style={{ ...G, fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "3px 10px", color: risk.color, background: risk.bg, display: "inline-block", marginTop: 8 }}>{risk.label}</span>
                <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 10, lineHeight: 1.5 }}>Combina sobra, reserva, comprometimento da renda e metas no prazo.</div>
              </div>
            </Card>
            {/* Patrimônio */}
            <Card style={{ flex: "1 1 340px", padding: 18 }}>
              <div style={cap}>Patrimônio líquido</div>
              <div style={{ ...G, ...NUM, fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", marginTop: 5 }}>{fmt(data.patrimonio_liquido)}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1, borderRadius: 10, background: T.greenLight, padding: "10px 12px" }}>
                  <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.green }}>ATIVO</div>
                  <div style={{ ...G, ...NUM, fontSize: 17, fontWeight: 700, color: T.green, marginTop: 2 }}>{fmt(data.ativo)}</div>
                  <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>saldo das contas</div>
                </div>
                <div style={{ flex: 1, borderRadius: 10, background: T.redLight, padding: "10px 12px" }}>
                  <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.red }}>PASSIVO</div>
                  <div style={{ ...G, ...NUM, fontSize: 17, fontWeight: 700, color: T.red, marginTop: 2 }}>{fmt(data.passivo)}</div>
                  <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>faturas em aberto</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Métricas */}
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <Metric label="Comprometimento da renda" value={pct(data.income_commitment)} sub="despesa ÷ renda média" color={commitColor(data.income_commitment)} />
            <Metric label="Sobra média mensal" value={fmt(data.avg_surplus)} sub={`taxa de poupança ${pct(data.savings_rate)}`} color={Number(data.avg_surplus) >= 0 ? T.green : T.red} />
            <Metric label="Meses de reserva" value={Number(data.emergency_fund_months).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub="reserva ÷ despesa média" />
            <Metric label="Metas no prazo" value={`${data.goals_on_track} de ${data.goals_total}`} sub={`progresso médio ${Math.round(data.goal_progress_avg)}%`} />
          </div>

          <div style={{ ...G, fontSize: 12, color: T.inkGhost, marginTop: 12 }}>Atualizado para {new Date(`${data.reference_month}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.</div>
        </>
      ) : null}
    </PageEnter>
  );
}
