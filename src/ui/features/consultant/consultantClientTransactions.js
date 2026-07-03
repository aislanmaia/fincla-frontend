/**
 * Modelo puro da aba "Transações" do relatório do cliente (RF.2, S3), fiel à
 * referência (`consultor/cons-relatorio-detail.jsx` → `TransacoesTab`). Sem React:
 * resume receitas/despesas/resultado e aplica busca + filtro por tipo. Opera sobre
 * as transações já mapeadas para a UI (`mapApiTransactionToUi`): usa `val` (com
 * sinal), `desc`, `cat`, `cartaoId`.
 */

/** Filtros da aba (fiel à referência): todas / receitas / despesas / no cartão. */
export const TX_FILTERS = [
  { id: "todos", label: "Todas" },
  { id: "income", label: "Receitas" },
  { id: "expense", label: "Despesas" },
  { id: "card", label: "No cartão" },
];

/** Soma receitas (val ≥ 0), despesas (|val| dos < 0) e o resultado. */
export function summarizeTransactions(txs) {
  const list = Array.isArray(txs) ? txs : [];
  let income = 0;
  let expense = 0;
  for (const t of list) {
    const v = Number(t.val) || 0;
    if (v >= 0) income += v;
    else expense += Math.abs(v);
  }
  return { income, expense, result: income - expense };
}

/** Normaliza para busca: minúsculas e sem acentos. */
function normalize(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Aplica filtro por tipo + busca (descrição/categoria). Não muta a entrada. */
export function filterTransactions(txs, { filter = "todos", query = "" } = {}) {
  const list = Array.isArray(txs) ? txs : [];
  const q = normalize(query).trim();
  return list.filter((t) => {
    const v = Number(t.val) || 0;
    if (filter === "income" && v < 0) return false;
    if (filter === "expense" && v >= 0) return false;
    if (filter === "card" && t.cartaoId == null) return false;
    if (q && !normalize(t.desc).includes(q) && !normalize(t.cat).includes(q)) return false;
    return true;
  });
}
