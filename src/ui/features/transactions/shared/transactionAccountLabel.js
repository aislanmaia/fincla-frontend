/**
 * Rótulo da conta de um lançamento para o detalhe da transação (#267).
 *
 * Devolve `null` quando a linha não deve aparecer:
 *  - compra no cartão: o detalhe já mostra o cartão no «Método», e a conta de
 *    liquidação dela é a do cartão — mostrar outra conta confundiria;
 *  - organização com uma conta ativa só (ou nenhuma carregada): não há o que
 *    distinguir, como no filtro;
 *  - lançamento sem `accountId`.
 *
 * Moeda: o código vai junto quando as contas ativas usam mais de uma moeda —
 * é aí que ele diferencia uma conta da outra. Conta fora da lista de ativas
 * (desativada) aparece como tal, em vez de sumir.
 *
 * @param {{ accountId?: string | null, settleable?: boolean } | null | undefined} tx
 * @param {Array<{ id: string, name: string, currency?: string | null }>} accounts contas ATIVAS
 * @returns {string | null}
 */
export function transactionAccountLabel(tx, accounts) {
  if (!tx || tx.settleable === false) return null;
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length < 2) return null;
  if (tx.accountId == null || String(tx.accountId) === "") return null;
  const account = list.find((a) => String(a.id) === String(tx.accountId));
  if (!account) return "Conta desativada";
  const currencies = new Set(list.map((a) => a.currency).filter(Boolean));
  return currencies.size > 1 && account.currency ? `${account.name} · ${account.currency}` : account.name;
}
