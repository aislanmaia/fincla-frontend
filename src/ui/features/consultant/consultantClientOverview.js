/**
 * Modelo puro da aba "Visão geral" do relatório do cliente (RF.1b, S3), fiel à
 * referência de design (`consultor/cons-relatorio.jsx`). Sem React nem tokens —
 * decide rótulos/valores/faixas; o componente formata cores via tokens.
 *
 * Fontes reais (org do cliente): a carteira (`useConsultantClients`) dá o saldo;
 * `GET /financial-health/score` dá renda/poupança/comprometimento/reserva/score;
 * `GET /analytics/by-category` alimenta o donut "para onde vai o dinheiro"; `goals`
 * as barras de metas. Blocos de IA/alertas/notas/próximos-passos são Trilha B (stub).
 *
 * Faixas: `income_commitment`/`savings_rate` são razões 0..1 (× 100 → %);
 * `emergency_fund_months` em meses; `score` 0..100.
 */

import { fmtBRL0, fmtPct } from "./consultantFormat";

const clamp = (v) => Math.max(0, Math.min(100, v));

/** Rótulo PT-BR da faixa de risco de fluxo de caixa. */
export function cashFlowRiskLabel(risk) {
  if (risk === "low") return "Risco baixo";
  if (risk === "high") return "Risco alto";
  return "Risco médio";
}

/**
 * Os 4 KPIs do topo do Overview (Saldo atual, Renda mensal, Taxa de poupança,
 * Comprometimento). `client` = item da carteira (saldo); `health` = payload de
 * saúde. `tone` é semântico ("ink"|"green"|"amber"|"red") — o componente mapeia.
 */
export function overviewKpis({ client, health } = {}) {
  const balance = Number(client?.balance) || 0;
  const income = Number(health?.avg_income) || 0;
  const savingsPct = (Number(health?.savings_rate) || 0) * 100;
  const commitmentPct = (Number(health?.income_commitment) || 0) * 100;
  return [
    { key: "balance", label: "Saldo atual", value: fmtBRL0(balance), tone: balance >= 0 ? "ink" : "red", sub: balance < 0 ? "negativo no mês" : "disponível" },
    { key: "income", label: "Renda mensal", value: fmtBRL0(income), tone: "ink", sub: "média mensal" },
    { key: "savings", label: "Taxa de poupança", value: fmtPct(savingsPct), tone: savingsPct >= 15 ? "green" : savingsPct >= 0 ? "amber" : "red", sub: "da renda líquida" },
    { key: "commitment", label: "Comprometimento", value: fmtPct(commitmentPct), tone: commitmentPct <= 30 ? "green" : commitmentPct <= 50 ? "amber" : "red", sub: "da renda com dívidas" },
  ];
}

/** Cor semântica de uma barra de fator/meta pelo valor 0..100. */
export function factorTone(v) {
  return v >= 65 ? "green" : v >= 40 ? "amber" : "red";
}

/**
 * Os 4 fatores do "Diagnóstico de saúde" (barras 0..100 + hint), derivados do
 * payload de saúde. Maior = melhor em todos.
 */
export function diagnosisFactors(health) {
  if (!health) return [];
  const commitmentRatio = Number(health.income_commitment) || 0;
  const savingsRatio = Number(health.savings_rate) || 0;
  const months = Number(health.emergency_fund_months) || 0;
  const score = Number(health.score) || 0;

  const reserve = clamp((months / 6) * 100);
  const commitment = clamp(100 - commitmentRatio * 100);
  const savings = clamp(savingsRatio * 100 * 3 + 18);
  const consistency = clamp(score);

  return [
    { key: "reserve", label: "Reserva de emergência", v: Math.round(reserve), hint: reserve < 40 ? "abaixo do ideal" : "saudável" },
    { key: "commitment", label: "Comprometimento de renda", v: Math.round(commitment), hint: commitmentRatio > 0.5 ? "renda muito comprometida" : "sob controle" },
    { key: "savings", label: "Taxa de poupança", v: Math.round(savings), hint: savingsRatio * 100 < 10 ? "poupa pouco" : "bom ritmo" },
    { key: "consistency", label: "Consistência mensal", v: Math.round(consistency), hint: consistency >= 60 ? "estável" : "requer atenção" },
  ];
}

const DONUT_FALLBACK = ["#0F0F0D", "#2563EB", "#7C3AED", "#D97706", "#059669", "#DC2626", "#9CA3AF"];

/**
 * Segmentos do donut "para onde vai o dinheiro" a partir de `by-category`
 * (`CategoryDataPoint[]`). Usa a cor da tag quando houver, senão uma paleta de
 * fallback estável por posição. Retorna também `total`. Ordena do maior p/ menor.
 */
export function categorySegments(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const sorted = [...list].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  const total = sorted.reduce((s, c) => s + (Number(c.total) || 0), 0);
  const segments = sorted.map((c, i) => ({
    label: c.tag_name || "Sem categoria",
    value: Number(c.total) || 0,
    color: c.tag_color || DONUT_FALLBACK[i % DONUT_FALLBACK.length],
    pct: total > 0 ? Math.round(((Number(c.total) || 0) / total) * 100) : 0,
  }));
  return { segments, total };
}

/** Resumo de metas (on-track/total + progresso médio) do payload de saúde. */
export function overviewGoalsSummary(health) {
  return {
    onTrack: Number(health?.goals_on_track) || 0,
    total: Number(health?.goals_total) || 0,
    progress: Math.round(Number(health?.goal_progress_avg) || 0),
  };
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Série mensal de "Evolução do patrimônio" a partir de `/analytics/monthly-evolution`
 * (`months`: `{ year, month, total_income, total_expenses, balance }[]`) — reusa o
 * shape do `CashFlowChart` (barras receita/despesa + linha de saldo) para o cliente.
 */
export function selectClientEvolutionSeries(months, limit = 12) {
  const list = Array.isArray(months) ? months : [];
  return list.slice(-limit).map((m) => {
    const abbr = MONTH_ABBR[(Number(m?.month) || 1) - 1] ?? "";
    const yy = m?.year != null ? `/${String(m.year).slice(-2)}` : "";
    return {
      month: `${abbr}${yy}`,
      income: Number(m?.total_income) || 0,
      expenses: Number(m?.total_expenses) || 0,
      balance: Number(m?.balance) || 0,
    };
  });
}
