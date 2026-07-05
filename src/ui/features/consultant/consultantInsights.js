/**
 * Modelo puro do Insights da carteira (S4), fiel à referência (`cons-insights.jsx`).
 * Sem React. Deriva o que há dado real: gasto agregado por categoria ("Onde a base
 * gasta") e os "movers" (clientes evoluindo/em queda pela tendência). Elementos sem
 * fonte (migração de risco histórica, perfil de renda, retenção, IA) ficam como
 * stub "em breve" na página.
 */

const EXPENSE_PALETTE = ["#2563EB", "#7C3AED", "#D97706", "#059669", "#DC2626", "#0F0F0D", "#9CA3AF"];

/**
 * Linhas do gráfico "Onde a base gasta" a partir de `expenses-by-category`
 * (`{ name, total, percentage }[]`): top N por gasto, com cor da paleta e o `max`
 * para a largura relativa das barras.
 */
export function selectExpenseRows(categories, limit = 6) {
  const list = Array.isArray(categories) ? categories : [];
  const rows = [...list]
    .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
    .slice(0, limit)
    .map((c, i) => ({
      label: c.name || "Sem categoria",
      value: Number(c.total) || 0,
      pct: Math.round(Number(c.percentage) || 0),
      color: EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
    }));
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return { rows, max };
}

/**
 * Divide a carteira em "maiores evoluções" (tendência `up`) e "precisam de atenção"
 * (tendência `down`), até `limit` cada — para os cartões de movers. Opera sobre a
 * lista enriquecida (`useConsultantClients`).
 */
export function selectMovers(clients, limit = 3) {
  const list = Array.isArray(clients) ? clients : [];
  const gainers = list.filter((c) => c.trend === "up").slice(0, limit);
  const decliners = list.filter((c) => c.trend === "down").slice(0, limit);
  return { gainers, decliners };
}

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Rótulo curto de mês (ex.: "mar/25") a partir de `month_number` + `year`. */
function monthLabel(monthNumber, year) {
  const abbr = MONTH_ABBR[(Number(monthNumber) || 1) - 1] ?? "";
  const yy = year != null ? `/${String(year).slice(-2)}` : "";
  return `${abbr}${yy}`;
}

/**
 * Série mensal do "Fluxo da base" a partir de `/consultant/cash-flow`
 * (`monthly_data`): últimos `limit` meses com receita, despesa e saldo — pronta
 * para o `ComposedChart` (barras receita/despesa + linha de saldo).
 */
export function selectCashFlowSeries(monthlyData, limit = 12) {
  const list = Array.isArray(monthlyData) ? monthlyData : [];
  return list.slice(-limit).map((m) => ({
    month: monthLabel(m?.month_number, m?.year),
    income: Number(m?.total_income) || 0,
    expenses: Number(m?.total_expenses) || 0,
    balance: Number(m?.balance) || 0,
  }));
}

/**
 * Série mensal do "Comprometimento de renda" a partir de
 * `/consultant/income-commitment` (`monthly_data`): últimos `limit` meses com o
 * percentual da renda comprometido com faturas de cartão.
 */
export function selectIncomeCommitmentSeries(monthlyData, limit = 12) {
  const list = Array.isArray(monthlyData) ? monthlyData : [];
  return list.slice(-limit).map((m) => ({
    month: monthLabel(m?.month_number, m?.year),
    pct: Math.round((Number(m?.income_commitment_percent) || 0) * 10) / 10,
  }));
}

const GOAL_LABELS = {
  reserva_emergencia: "Reserva de emergência",
  viagem: "Viagem",
  carro: "Carro",
  casa: "Casa",
  imovel: "Imóvel",
  aposentadoria: "Aposentadoria",
  investimento: "Investimento",
  educacao: "Educação",
  outros: "Outros",
};

/** Humaniza o tipo de meta (`reserva_emergencia` → "Reserva de emergência"). */
function humanizeGoal(name) {
  if (!name) return "Meta";
  if (GOAL_LABELS[name]) return GOAL_LABELS[name];
  const spaced = String(name).replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Linhas do "Progresso de metas por tipo" a partir de
 * `/consultant/goals-progress-by-type` (`by_type`): top N por progresso médio,
 * com rótulo humanizado, o `value` 0–100 (para a barra, max=100) e a contagem.
 */
export function selectGoalsProgressRows(byType, limit = 6) {
  const list = Array.isArray(byType) ? byType : [];
  return [...list]
    .sort((a, b) => (Number(b?.avg_progress) || 0) - (Number(a?.avg_progress) || 0))
    .slice(0, limit)
    .map((g, i) => ({
      label: humanizeGoal(g?.goal_name),
      value: Math.round(Number(g?.avg_progress) || 0),
      count: Number(g?.count) || 0,
      color: EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
    }));
}

/**
 * CSV (pt-BR, separador ";") do relatório consolidado da base
 * (`/consultant/reports/consolidated` → mesmo shape do `/summary`). Usado pelo
 * botão "Exportar" para baixar os números agregados da carteira.
 */
export function buildConsolidatedCsv(summary) {
  const s = summary || {};
  const rows = [
    ["Métrica", "Valor"],
    ["Receita total", s.total_income ?? 0],
    ["Despesa total", s.total_expenses ?? 0],
    ["Saldo", s.balance ?? 0],
    ["Transações", s.total_transactions ?? 0],
    ["Organizações", s.organizations_count ?? 0],
    ["Período início", s.period_start ?? ""],
    ["Período fim", s.period_end ?? ""],
  ];
  return rows.map((r) => r.join(";")).join("\n");
}
