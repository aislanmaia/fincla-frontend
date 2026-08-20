// api/transactions.ts
import apiClient from './client';
import {
  IDEMPOTENCY_KEY_HEADER,
  noteIdempotencySupportFromHeaders,
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
  options?: { idempotencyKey?: string }
): Promise<Transaction> => {
  const key = options?.idempotencyKey;
  const response = await apiClient.post<Transaction>(
    '/transactions',
    transaction,
    key ? { headers: { [IDEMPOTENCY_KEY_HEADER]: key } } : undefined
  );
  // `Idempotent-Replay` presente = este backend implementa a feature. É essa
  // observação que libera o retry automático da criação; sem ela o cliente
  // não repete nada (ver `src/api/idempotency.ts`).
  if (key) noteIdempotencySupportFromHeaders(response.headers);
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
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
  return response.data;
};
