// api/recurringTransactions.ts
import apiClient from './client';
import type {
  RecurringTransaction,
  CreateRecurringTransactionRequest,
  UpdateRecurringTransactionRequest,
  RecurringTransactionListResponse,
  GenerateFromRecurringRequest,
  GenerateFromRecurringResponse,
} from './types';

/**
 * Cria uma nova transação recorrente
 */
export const createRecurringTransaction = async (
  organizationId: string,
  data: CreateRecurringTransactionRequest
): Promise<RecurringTransaction> => {
  const response = await apiClient.post<RecurringTransaction>(
    '/recurring-transactions',
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Lista todas as transações recorrentes da organização com resumo
 */
export const listRecurringTransactions = async (
  organizationId: string,
  isActive?: boolean
): Promise<RecurringTransactionListResponse> => {
  const response = await apiClient.get<RecurringTransactionListResponse>(
    '/recurring-transactions',
    { params: { organization_id: organizationId, is_active: isActive } }
  );
  return response.data;
};

/**
 * Obtém detalhes de uma transação recorrente específica
 */
export const getRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<RecurringTransaction> => {
  const response = await apiClient.get<RecurringTransaction>(
    `/recurring-transactions/${rtId}`,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Atualiza campos de uma transação recorrente (partial update).
 * A `next_occurrence` é recalculada automaticamente se a frequência ou o dia for alterado.
 */
export const updateRecurringTransaction = async (
  rtId: string,
  organizationId: string,
  data: UpdateRecurringTransactionRequest
): Promise<RecurringTransaction> => {
  const response = await apiClient.patch<RecurringTransaction>(
    `/recurring-transactions/${rtId}`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Remove uma transação recorrente
 */
export const deleteRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/recurring-transactions/${rtId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Ativa ou pausa uma transação recorrente (alterna is_active)
 */
export const toggleRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<RecurringTransaction> => {
  const response = await apiClient.post<RecurringTransaction>(
    `/recurring-transactions/${rtId}/toggle`,
    null,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Gera uma transação real a partir do template recorrente para uma data específica.
 * Avança `next_occurrence` para a próxima data após a geração.
 */
export const generateFromRecurring = async (
  rtId: string,
  organizationId: string,
  data: GenerateFromRecurringRequest
): Promise<GenerateFromRecurringResponse> => {
  const response = await apiClient.post<GenerateFromRecurringResponse>(
    `/recurring-transactions/${rtId}/generate`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
