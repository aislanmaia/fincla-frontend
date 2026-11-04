/**
 * O id de uma conta de lista vem em duas formas: `account_id` (linhas de
 * `GET /balances`, usadas pelo modal) e `id` (`GET /accounts`, usadas por
 * /transactions). Uma regra só para as duas.
 */
const accountIdOf = (a) => (a?.account_id ?? a?.id ?? null);

/** A conta `accountId` dentro de `accounts` (ativas), ou `undefined`. */
export function findActiveAccount(accountId, accounts) {
  if (accountId == null || String(accountId) === "") return undefined;
  return (Array.isArray(accounts) ? accounts : []).find((a) => String(accountIdOf(a)) === String(accountId));
}

export const DEACTIVATED_ACCOUNT_LABEL = "Conta desativada";

/**
 * Nome de exibição de uma conta a partir da lista de contas ATIVAS — a ÚNICA regra
 * de "id fora da lista → «Conta desativada»", usada pelo select do modal, pela
 * revisão e pelo detalhe da transação (#266/#267).
 *
 * `null` quando não há id, ou quando a lista está vazia (não carregou: não dá para
 * afirmar que a conta foi desativada).
 */
export function accountDisplayName(accountId, accounts) {
  if (accountId == null || String(accountId) === "") return null;
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length === 0) return null;
  const account = findActiveAccount(accountId, list);
  return account ? account.name : DEACTIVATED_ACCOUNT_LABEL;
}

/**
 * Rótulo da conta de um lançamento para o detalhe da transação (#267).
 *
 * Devolve `null` quando a linha não deve aparecer:
 *  - compra no cartão: o detalhe já mostra o cartão no «Método», e a conta de
 *    liquidação dela é a do cartão;
 *  - lançamento sem `accountId`, ou contas não carregadas;
 *  - organização com UMA conta ativa e o lançamento está nela (não há o que
 *    distinguir, como no filtro). Se o lançamento está numa conta que NÃO é a
 *    ativa (desativada), a linha aparece — é justamente a informação que falta.
 *
 * Moeda: o código vai junto quando as contas ativas usam mais de uma moeda.
 *
 * @param {{ accountId?: string | null, settleable?: boolean } | null | undefined} tx
 * @param {Array<{ id?: string, account_id?: string, name: string, currency?: string | null }>} accounts contas ATIVAS
 * @returns {string | null}
 */
export function transactionAccountLabel(tx, accounts) {
  if (!tx || tx.settleable === false) return null;
  const list = Array.isArray(accounts) ? accounts : [];
  const name = accountDisplayName(tx.accountId, list);
  if (name == null) return null;
  const account = findActiveAccount(tx.accountId, list);
  if (!account) return name;
  if (list.length < 2) return null;
  const currencies = new Set(list.map((a) => a.currency).filter(Boolean));
  return currencies.size > 1 && account.currency ? `${account.name} · ${account.currency}` : account.name;
}
