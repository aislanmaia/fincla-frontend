/**
 * Modelo puro da aba "Categorias" do relatório do cliente (RF.4, S3), fiel à
 * referência (`consultor/cons-relatorio-detail.jsx` → `CategoriasTab`). Opera sobre
 * `GET /analytics/by-category` (`CategoryDataPoint[]`, o mesmo read do donut da Visão
 * geral). Sem React.
 *
 * Mapeamento honesto: `budget` e `trend` (MoM) da referência **não vêm** nesse
 * endpoint (single-period, sem orçamento) → a aba mostra `transaction_count` no lugar
 * do orçamento e omite a coluna de tendência. Campos reais: label/cor/ícone/`percentage`/
 * `total`/`transaction_count`.
 */

const CAT_FALLBACK = ["#0F0F0D", "#2563EB", "#7C3AED", "#D97706", "#059669", "#DC2626", "#9CA3AF"];

/** Projeta um `CategoryDataPoint` para a linha da aba (ordenação/`max` ficam no select). */
export function toCategoryRow(cat, index = 0) {
  return {
    id: cat.tag_id ?? cat.tag_name ?? String(index),
    label: cat.tag_name || "Sem categoria",
    color: cat.tag_color || CAT_FALLBACK[index % CAT_FALLBACK.length],
    iconKey: cat.tag_icon_key ?? null,
    pct: Math.round(Number(cat.percentage) || 0),
    value: Number(cat.total) || 0,
    count: Number(cat.transaction_count) || 0,
  };
}

/**
 * Lista de categorias ordenada do maior gasto para o menor + o `max` (para a
 * largura relativa das barras) e o `total`. Tolera entrada ausente.
 */
export function selectClientCategories(categories) {
  const list = Array.isArray(categories) ? categories : [];
  const sorted = [...list].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  const rows = sorted.map(toCategoryRow);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return { rows, max, total };
}
