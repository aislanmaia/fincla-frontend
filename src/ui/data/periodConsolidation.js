import { getTransactionsSummary } from "../../api/transactions";

/**
 * O recibo de conversão das DESPESAS de um período — `{ target_currency, rates }`
 * de `/transactions/summary` —, para quem soma transações no navegador (curva de
 * ritmo, velocidade) e precisa da mesma taxa que fez o total do período.
 *
 * Não engole falha: rede caída não é "falta cotação", e quem chama decide entre
 * mostrar o erro (com "tentar de novo") ou cair noutro recibo que já tenha.
 */
export async function fetchExpenseConsolidation(organizationId, dateStart, dateEnd) {
  const summary = await getTransactionsSummary({
    organization_id: organizationId,
    date_start: dateStart,
    date_end: dateEnd,
    type: "expense",
  });
  return summary?.consolidation ?? null;
}
