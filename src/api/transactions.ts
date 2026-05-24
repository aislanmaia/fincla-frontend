// api/transactions.ts
import apiClient from './client';
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
 * Cria uma nova transação
 */
export const createTransaction = async (
  transaction: CreateTransactionRequest
): Promise<Transaction> => {
  const response = await apiClient.post<Transaction>(
    '/transactions',
    transaction
  );
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
    { params: filters }
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
    { params: filters }
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
