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
