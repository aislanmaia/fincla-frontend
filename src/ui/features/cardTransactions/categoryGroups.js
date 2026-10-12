/** Linhas do resumo mostradas de uma vez; as demais ficam atrás do link "ver mais". */
export const SUMMARY_CATEGORY_LIMIT = 5;

const size = (row) => Math.abs(Number(row.amount));

/**
 * Ordena as categorias do maior para o menor valor e mostra só as `limit` primeiras.
 * `all` é a lista completa para o modal; `hidden` é quantas ficaram de fora.
 */
export function groupCategories(rows, limit = SUMMARY_CATEGORY_LIMIT) {
  const all = [...rows].sort((a, b) => size(b) - size(a));
  return { visible: all.slice(0, limit), all, hidden: Math.max(0, all.length - limit) };
}
