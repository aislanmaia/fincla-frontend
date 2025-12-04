// api/transactions.ts
import apiClient from './client';
import { CreateTransactionRequest, Transaction, ListTransactionsQuery } from '../types/api';

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
 * Lista transações com filtros opcionais
 */
export const listTransactions = async (
  filters?: ListTransactionsQuery
): Promise<Transaction[]> => {
  const response = await apiClient.get<Transaction[]>(
    '/transactions',
    { params: filters }
  );
  return response.data;
};

