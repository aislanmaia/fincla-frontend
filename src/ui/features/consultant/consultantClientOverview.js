/**
 * Modelo puro da aba "Visão geral" do relatório do cliente (A3.2a, S3). Transforma
 * a resposta de `GET /v1/financial-health/score` (endpoint por-org provado na A3.0,
 * consumido com `organization_id` = org do cliente) no view-model do cabeçalho de
 * diagnóstico + grade de KPIs + resumo de metas. Sem React nem tokens — testável.
 *
 * Faixas dos campos (confirmadas no DTO do backend / HealthPanelPage):
 *  - `income_commitment`, `savings_rate` são razões 0..1 → exibidas em % (×100).
 *  - `goal_progress_avg` já é 0..100 (não multiplicar).
 *  - `emergency_fund_months` em meses; `avg_*`/`patrimonio_liquido` em reais.
 */

import { fmtMoney, fmtPct } from "./consultantFormat";

/** Formata o valor de um KPI da Visão geral conforme seu `kind`. */
export function formatOverviewKpi(kpi) {
  if (kpi.kind === "money") return fmtMoney(kpi.value);
  if (kpi.kind === "pct") return fmtPct(kpi.value);
  if (kpi.kind === "months") {
    const n = Number(kpi.value) || 0;
    return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n === 1 ? "mês" : "meses"}`;
  }
  return String(kpi.value);
}

/** Rótulo PT-BR da faixa de risco de fluxo de caixa. */
export function cashFlowRiskLabel(risk) {
  if (risk === "low") return "Risco baixo";
  if (risk === "high") return "Risco alto";
  return "Risco médio";
}

/**
 * View-model da Visão geral a partir do payload de saúde financeira (ou null).
 * `bad` marca o valor numa faixa ruim (o componente pinta de vermelho); o resto
 * fica neutro. Não formata — o componente aplica `formatOverviewKpi` + tokens.
 */
export function selectClientOverview(data) {
  if (!data) return null;

  const netWorth = Number(data.patrimonio_liquido) || 0;
  const surplus = Number(data.avg_surplus) || 0;
  const commitmentPct = (Number(data.income_commitment) || 0) * 100;
  const savingsPct = (Number(data.savings_rate) || 0) * 100;
  const reserve = Number(data.emergency_fund_months) || 0;

  return {
    score: Math.round(Number(data.score) || 0),
    risk: { key: data.cash_flow_risk ?? "medium", label: cashFlowRiskLabel(data.cash_flow_risk) },
    kpis: [
      { key: "net_worth", label: "Patrimônio líquido", kind: "money", value: netWorth, bad: netWorth < 0 },
      { key: "avg_income", label: "Renda média", kind: "money", value: Number(data.avg_income) || 0 },
      { key: "avg_expense", label: "Despesa média", kind: "money", value: Number(data.avg_expense) || 0 },
      { key: "avg_surplus", label: "Sobra média", kind: "money", value: surplus, bad: surplus < 0 },
      { key: "commitment", label: "Comprometimento da renda", kind: "pct", value: commitmentPct, bad: commitmentPct > 80 },
      { key: "savings", label: "Taxa de poupança", kind: "pct", value: savingsPct, bad: savingsPct < 0 },
      { key: "reserve", label: "Meses de reserva", kind: "months", value: reserve, bad: reserve < 1 },
    ],
    goals: {
      onTrack: Number(data.goals_on_track) || 0,
      total: Number(data.goals_total) || 0,
      progress: Math.round(Number(data.goal_progress_avg) || 0),
    },
  };
}
