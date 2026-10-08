// api/budgets.ts
//
// Orçamento, gasto e restante chegam na forma canônica (fincla-api#132).
// `unwrapMoney` desembrulha em qualquer profundidade — enumerar campo a campo é
// onde se esquece um, e um esquecido vira "R$ NaN" na tela.
import apiClient from './client';
import { toCurrency, unwrapMoney } from './money';
import type {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  BudgetListResponse,
  PreviewTransactionRequest,
  PreviewTransactionResponse,
} from './types';

/**
 * Cria um novo orçamento para uma tag/categoria
 */
export const createBudget = async (
  organizationId: string,
  data: CreateBudgetRequest
): Promise<Budget> => {
  const response = await apiClient.post<Budget>('/budgets', data, {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

/**
 * Lista todos os orçamentos da organização com resumo consolidado
 */
export const listBudgets = async (
  organizationId: string,
  periodType?: string,
  isActive?: boolean
): Promise<BudgetListResponse> => {
  const response = await apiClient.get<BudgetListResponse>('/budgets', {
    params: {
      organization_id: organizationId,
      ...(periodType !== undefined && periodType !== '' ? { period_type: periodType } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    },
  });
  const unwrapped = unwrapMoney(response.data);
  return {
    ...unwrapped,
    budgets: unwrapped.budgets.map((budget, index) => ({
      ...budget,
      currency: toCurrency(response.data.budgets[index]?.amount),
    })),
  };
};

/**
 * Obtém detalhes de um orçamento específico
 */
export const getBudget = async (
  budgetId: string,
  organizationId: string
): Promise<Budget> => {
  const response = await apiClient.get<Budget>(`/budgets/${budgetId}`, {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

/**
 * Atualiza campos de um orçamento (partial update)
 */
export const updateBudget = async (
  budgetId: string,
  organizationId: string,
  data: UpdateBudgetRequest
): Promise<Budget> => {
  const response = await apiClient.patch<Budget>(
    `/budgets/${budgetId}`,
    data,
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Remove um orçamento
 */
export const deleteBudget = async (
  budgetId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/budgets/${budgetId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Preview de impacto em orçamentos (transação ainda não persistida).
 * Usar com debounce no modal Nova transação.
 */
export const previewTransactionImpact = async (
  body: PreviewTransactionRequest
): Promise<PreviewTransactionResponse> => {
  const response = await apiClient.post<PreviewTransactionResponse>(
    '/budgets/preview-transaction',
    body
  );
  return unwrapMoney(response.data);
};
