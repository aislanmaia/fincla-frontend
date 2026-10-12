/** Linhas do resumo mostradas de uma vez; o resto vira "Outros" e abre numa lista completa. */
export const SUMMARY_CATEGORY_LIMIT = 5;
export const OTHERS_LABEL = "Outros";

const size = (row) => Math.abs(Number(row.amount));

/**
 * Ordena as categorias do maior para o menor valor e, passando do limite, junta a cauda numa
 * linha "Outros" (a soma é a real, com sinal: estorno abate). `all` é a lista completa para o modal.
 */
export function groupCategories(rows, limit = SUMMARY_CATEGORY_LIMIT) {
  const all = [...rows].sort((a, b) => size(b) - size(a));
  if (all.length <= limit) return { visible: all, all, others: null };
  const head = all.slice(0, limit - 1);
  const tail = all.slice(limit - 1);
  const amount = tail.reduce((acc, row) => acc + Number(row.amount), 0);
  const others = { category: OTHERS_LABEL, amount, amount_currency: tail[0].amount_currency, isOthers: true, count: tail.length };
  return { visible: [...head, others], all, others };
}
