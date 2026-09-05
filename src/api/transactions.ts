// api/transactions.ts
//
// Os valores de transação, parcela e resumo chegam na forma canônica (fincla-api#131).
// `unwrapMoney` desembrulha em qualquer profundidade — enumerar campo a campo é
// onde se esquece um, e um esquecido vira "R$ NaN" na tela.
import apiClient from './client';
import { unwrapMoney } from './money';
import {
  IDEMPOTENCY_KEY_HEADER,
  noteIdempotencySupportFromHeaders,
  readIdempotentReplay,
} from './idempotency';
import { repeatArrayParams } from './paramsSerializer';
import type {
  CreateTransactionRequest,
  UpdateTransactionRequest,
  Transaction,
  ListTransactionsQuery,
  PaginatedTransactionsResponse,
  TransactionsSummaryQuery,
  TransactionsSummaryResponse,
  TransactionsFacetsQuery,
  TransactionsFacetsResponse,
} from './types';

/**
 * Cria uma nova transação.
 *
 * `options.idempotencyKey` vai no header `Idempotency-Key` (ver
 * `src/api/idempotency.ts`). É o que torna o reenvio deste POST seguro: com a
 * MESMA chave, o backend devolve a resposta original em vez de criar uma
 * segunda transação. O header é OPCIONAL no contrato — omitir mantém o
 * comportamento antigo, e um backend que ainda não conhece o header
 * simplesmente o ignora.
 */
export const createTransaction = async (
  transaction: CreateTransactionRequest,
  options?: {
    idempotencyKey?: string;
    /**
     * Recebe o VALOR de `Idempotent-Replay` quando o backend o manda. `true`
     * significa "esta é a resposta original de uma chave já vista, nada foi
     * criado agora" — a única forma determinística de saber que um
     * "Registrado!" na tela seria mentira.
     */
    onIdempotentReplay?: (replayed: boolean) => void;
  }
): Promise<Transaction> => {
  const key = options?.idempotencyKey;
  const response = await apiClient.post<Transaction>(
    '/transactions',
    transaction,
    key ? { headers: { [IDEMPOTENCY_KEY_HEADER]: key } } : undefined
  );
  if (key) {
    // A PRESENÇA do header prova que este backend implementa a feature — é
    // essa observação que libera o retry automático da criação.
    noteIdempotencySupportFromHeaders(response.headers);
    const replayed = readIdempotentReplay(response.headers);
    if (replayed != null) options?.onIdempotentReplay?.(replayed);
  }
  return unwrapMoney(response.data);
};

/**
 * Lista transações com filtros opcionais e paginação
 * Retorna resposta paginada com metadata
 */
export const listTransactions = async (
  filters: ListTransactionsQuery
): Promise<PaginatedTransactionsResponse> => {
  const response = await apiClient.get<PaginatedTransactionsResponse>(
    '/transactions',
    { params: filters, paramsSerializer: repeatArrayParams }
  );
  return unwrapMoney(response.data);
};

/**
 * Obtém estatísticas agregadas das transações (KPIs)
 * Útil para calcular métricas sem precisar buscar todas as transações
 */
export const getTransactionsSummary = async (
  filters: TransactionsSummaryQuery
): Promise<TransactionsSummaryResponse> => {
  const response = await apiClient.get<TransactionsSummaryResponse>(
    '/transactions/summary',
    { params: filters, paramsSerializer: repeatArrayParams }
  );
  return unwrapMoney(response.data);
};

/**
 * Contagens por opção do painel de filtro — «quantas linhas eu teria se
 * marcasse esta opção», com todos os OUTROS filtros aplicados.
 *
 * Recebe os MESMOS filtros da lista (menos paginação e ordenação): é isso que
 * faz `total` bater com o total da listagem na tela. Ver
 * `fincla-api/docs/FRONTEND_API_GUIDE.md` para a semântica de drill-down e
 * para a ressalva de que uma facet com filtro próprio ativo não particiona.
 */
export const getTransactionsFacets = async (
  filters: TransactionsFacetsQuery
): Promise<TransactionsFacetsResponse> => {
  const response = await apiClient.get<TransactionsFacetsResponse>(
    '/transactions/facets',
    { params: filters, paramsSerializer: repeatArrayParams }
  );
  return unwrapMoney(response.data);
};

/**
 * Busca uma transação específica por ID.
 *
 * @param options.includeRefunds Quando true, popula `refunds: Transaction[]` com
 *   a lista completa dos estornos linkados via refund_of_transaction_id.
 *   `refunds_summary` é sempre populado quando há estornos, independente desta flag.
 */
export const getTransaction = async (
  transactionId: string | number,
  organizationId: string,
  options?: { includeRefunds?: boolean }
): Promise<Transaction> => {
  const params: Record<string, string> = { organization_id: organizationId };
  if (options?.includeRefunds) params.include_refunds = "true";
  const response = await apiClient.get<Transaction>(
    `/transactions/${transactionId}`,
    { params }
  );
  return unwrapMoney(response.data);
};

/**
 * Atualiza uma transação existente
 */
export const updateTransaction = async (
  transactionId: string | number,
  organizationId: string,
  transaction: UpdateTransactionRequest
): Promise<Transaction> => {
  const response = await apiClient.put<Transaction>(
    `/transactions/${transactionId}`,
    transaction,
    {
      params: { organization_id: organizationId },
    }
  );
  return unwrapMoney(response.data);
};

/**
 * Deleta uma transação
 */
export const deleteTransaction = async (
  transactionId: number,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/transactions/${transactionId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Marca uma transação como paga (liquidada).
 *
 * Liquidar é o que faz a transação entrar no saldo da conta: o backend só soma
 * `status='paid'`. Sem `paidAt` o backend usa "agora".
 */
export const settleTransaction = async (
  transactionId: string | number,
  organizationId: string,
  paidAt?: string
): Promise<Transaction> => {
  const response = await apiClient.patch<Transaction>(
    `/transactions/${transactionId}/settle`,
    paidAt ? { paid_at: paidAt } : {},
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Volta uma transação para pendente (`status='confirmed'`, `paid_at=null`),
 * tirando-a do saldo da conta.
 */
export const unsettleTransaction = async (
  transactionId: string | number,
  organizationId: string
): Promise<Transaction> => {
  const response = await apiClient.patch<Transaction>(
    `/transactions/${transactionId}/unsettle`,
    {},
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};
