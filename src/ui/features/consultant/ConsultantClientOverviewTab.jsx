import React from "react";

import { Card, ProgBar } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtK } from "../../formatters";
import { Donut, Icon, useIsNarrow } from "./consultantUi";
import { fmtBRL0 } from "./consultantFormat";
import { CashFlowChart } from "./ConsultantInsightsCharts.jsx";
import {
  categorySegments,
  diagnosisFactors,
  factorTone,
  overviewGoalsSummary,
  overviewKpis,
  selectClientEvolutionSeries,
} from "./consultantClientOverview";

const TONE = { ink: T.ink, green: T.green, amber: T.amber, red: T.red };
const toneColor = (t) => TONE[t] || T.ink;

// ── KPI ─────────────────────────────────────────────────────────
function RptKpi({ label, value, color = T.ink, sub }) {
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.01em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}

// ── Cabeçalho de card ───────────────────────────────────────────
function CardHead({ title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
      {right}
    </div>
  );
}

const SoonChip = () => (
  <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "2px 6px" }}>em breve</span>
);

/** Card "em breve" (Trilha B) — preserva o bloco no layout com um placeholder. */
function StubCard({ title, icon, text, dark }) {
  return (
    <Card style={{ padding: 18, background: dark ? T.darkBg : T.surface, borderColor: dark ? T.darkBg : T.border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon && <Icon name={icon} size={15} color={dark ? T.darkPurple : T.inkGhost} />}
        <span style={{ ...G, fontSize: 13.5, fontWeight: 800, color: dark ? "#fff" : T.ink }}>{title}</span>
        <span style={{ marginLeft: "auto" }}><SoonChip /></span>
      </div>
      <div style={{ ...G, fontSize: 12, color: dark ? T.darkMuted : T.inkLight, lineHeight: 1.55 }}>{text}</div>
    </Card>
  );
}

// ── Notas do consultor (perfil privado persistido) ──────────────
const GOAL_LABELS = { montar_reserva: "Montar reserva", quitar_dividas: "Quitar dívidas", investir: "Investir", aposentadoria: "Aposentadoria", comprar_imovel: "Comprar imóvel" };
const LEVEL_LABELS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };
const humanize = (map, v) => (v ? map[v] || (String(v).charAt(0).toUpperCase() + String(v).slice(1)) : null);

function NotesCard({ profile }) {
  const p = profile?.profile;
  const loading = Boolean(profile?.loading) && !profile?.hasLoaded;
  const hasProfile = Boolean(p?.has_profile);
  const goal = humanize(GOAL_LABELS, p?.main_goal);
  const level = humanize(LEVEL_LABELS, p?.experience_level);
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="pencil" size={15} color={T.inkGhost} />
        <span style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Notas do consultor</span>
        {hasProfile && p?.priority && (
          <span style={{ marginLeft: "auto", ...G, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.amber, background: T.amberLight, borderRadius: 99, padding: "2px 8px" }}>prioridade</span>
        )}
      </div>
      {loading ? (
        <div style={{ ...G, fontSize: 12, color: T.inkLight }}>Carregando…</div>
      ) : !hasProfile ? (
        <div style={{ ...G, fontSize: 12, color: T.inkLight, lineHeight: 1.55 }}>Sem notas registradas para este cliente.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {p.notes ? (
            <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{p.notes}</p>
          ) : (
            <p style={{ ...G, fontSize: 12, color: T.inkGhost, fontStyle: "italic", margin: 0 }}>Sem anotações escritas.</p>
          )}
          {Array.isArray(p.tags) && p.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.tags.map((t) => (
                <span key={t} style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, background: T.grayLight, borderRadius: 99, padding: "3px 10px" }}>{t}</span>
              ))}
            </div>
          )}
          {(goal || level) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              {goal && (
                <div><div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.06em" }}>Objetivo</div><div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink, marginTop: 2 }}>{goal}</div></div>
              )}
              {level && (
                <div><div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.06em" }}>Experiência</div><div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink, marginTop: 2 }}>{level}</div></div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Donut "para onde vai o dinheiro" ────────────────────────────
function SpendingDonutCard({ categories }) {
  const { segments, total } = categorySegments(categories.categories);
  const body = () => {
    if (categories.loading && !categories.hasLoaded) return <div style={{ ...G, fontSize: 12.5, color: T.inkLight, padding: "8px 0" }}>Carregando…</div>;
    if (categories.error && !segments.length) return <div style={{ ...G, fontSize: 12.5, color: T.inkLight, padding: "8px 0" }}>Não foi possível carregar as categorias.</div>;
    if (!segments.length) return <div style={{ ...G, fontSize: 12.5, color: T.inkLight, padding: "8px 0" }}>Sem despesas categorizadas no período.</div>;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <Donut segments={segments} size={140} stroke={20}
          center={<><span style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{fmtK(total)}</span><span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkLight, textTransform: "uppercase" }}>gasto/mês</span></>} />
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 10 }}>
          {segments.slice(0, 6).map((x) => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: x.color, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 12.5, color: T.inkMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label}</span>
              <span style={{ ...G, ...NUM, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{fmtBRL0(x.value)}</span>
              <span style={{ ...G, ...NUM, fontSize: 10.5, color: T.inkGhost, width: 34, textAlign: "right" }}>{x.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <Card style={{ padding: 18 }}>
      <CardHead title="Para onde vai o dinheiro" right={<span style={{ ...G, fontSize: 11, color: T.inkLight }}>despesas · {fmtBRL0(total)}</span>} />
      {body()}
    </Card>
  );
}

// ── Metas em andamento ──────────────────────────────────────────
function GoalsCard({ goals }) {
  const list = Array.isArray(goals.goals) ? goals.goals : [];
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Metas em andamento</div>
      {goals.isLoading && !goals.hasLoaded ? (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight }}>Carregando…</div>
      ) : list.length === 0 ? (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight }}>Nenhuma meta cadastrada ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {list.slice(0, 6).map((g) => {
            const pct = Math.max(0, Math.min(100, Math.round(Number(g.progress) || 0)));
            const col = pct >= 60 ? T.green : pct >= 30 ? T.amber : T.red;
            return (
              <div key={g.id ?? g.nome}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <span style={{ ...G, fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nome}</span>
                  <span style={{ ...G, ...NUM, fontSize: 12.5, fontWeight: 800, color: col }}>{pct}%</span>
                </div>
                <ProgBar pct={pct} color={col} h={7} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Diagnóstico de saúde ────────────────────────────────────────
function DiagnosisCard({ health }) {
  const factors = diagnosisFactors(health.data);
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Diagnóstico de saúde</div>
      {health.loading && !health.data ? (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight }}>Carregando…</div>
      ) : factors.length === 0 ? (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight }}>Sem dados suficientes.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {factors.map((f) => {
            const col = toneColor(factorTone(f.v));
            return (
              <div key={f.key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                  <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{f.label}</span>
                  <span style={{ ...G, fontSize: 10.5, color: col, fontWeight: 700 }}>{f.hint}</span>
                </div>
                <ProgBar pct={f.v} color={col} h={6} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * Aba "Visão geral" do relatório do cliente (RF.1b), fiel a `cons-relatorio.jsx`:
 * card de leitura da IA (stub), 4 KPIs, e um corpo de 2 colunas (mobile-first,
 * empilha em telas estreitas) — donut "para onde vai o dinheiro", evolução (stub),
 * metas, ritmo (stub) à esquerda; diagnóstico, alertas/notas/próximos-passos
 * (stubs) à direita. Recebe o estado dos hooks por-org via props.
 */
export function ConsultantClientOverviewTab({ client, health, categories, goals, evolution, profile }) {
  const narrow = useIsNarrow(900);
  const kpis = overviewKpis({ client, health: health.data });
  const healthReady = health.hasLoaded && !!health.data;
  const goalsSummary = overviewGoalsSummary(health.data);
  const evolutionSeries = selectClientEvolutionSeries(evolution?.months);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Leitura da IA — Trilha B */}
      <Card style={{ padding: 18, background: `linear-gradient(160deg, ${T.purpleLight}, ${T.surface} 70%)`, borderColor: "#E6DEFB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="sparkles" size={14} color="#fff" /></div>
          <span style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink }}>Leitura da IA sobre {String(client.client_name || "").split(" ")[0]}</span>
          <span style={{ marginLeft: "auto" }}><SoonChip /></span>
        </div>
        <p style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.65, margin: 0 }}>
          Em breve a IA vai ler os números deste cliente e sugerir um resumo executivo, um plano de ação e mensagens prontas para você revisar e enviar.
        </p>
      </Card>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr) minmax(0,1fr)" : "repeat(4, minmax(0,1fr))", gap: 12 }}>
        {kpis.map((k) => (
          <RptKpi key={k.key} label={k.label} value={healthReady || k.key === "balance" ? k.value : "…"} color={toneColor(k.tone)} sub={k.sub} />
        ))}
      </div>

      {/* Corpo 2 colunas (minmax(0,…) deixa a coluna 1fr encolher — sem overflow) */}
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <SpendingDonutCard categories={categories} />
          <CashFlowChart
            data={evolutionSeries}
            loading={Boolean(evolution?.loading) && !evolution?.hasLoaded}
            title="Evolução mensal"
            subtitle="Receita × despesa e saldo, mês a mês"
            emptyText="Sem histórico mensal para este cliente."
          />
          <SpendingPaceStub />
          <GoalsCard goals={goals} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <DiagnosisCard health={health} />
          <Card style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Metas no prazo</div>
              <Icon name="target" size={14} color={T.inkGhost} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: T.ink }}>{goalsSummary.onTrack} de {goalsSummary.total}</span>
            </div>
            <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, marginTop: 3 }}>progresso médio {goalsSummary.progress}%</div>
          </Card>
          <StubCard title="Alertas ativos" icon="alert" text="Em breve: alertas automáticos de risco (dívida, orçamento estourado, atividade parada)." />
          <NotesCard profile={profile} />
          <StubCard title="Próximos passos sugeridos" icon="flag" text="Em breve: um plano de ação priorizado, detalhável com IA." dark />
        </div>
      </div>
    </div>
  );
}

function SpendingPaceStub() {
  return <StubCard title="Ritmo de gastos" icon="bar" text="Em breve: acumulado real vs. orçamento do mês, com projeção de fechamento." />;
}
