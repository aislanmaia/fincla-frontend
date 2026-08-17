// api/balanceAdjustments.ts
import apiClient from './client';
import type {
  BalanceAdjustment,
  CreateBalanceAdjustmentRequest,
  UpdateBalanceAdjustmentRequest,
} from './types';

/** Cria um ajuste de saldo (reconciliação) numa conta. */
export const createBalanceAdjustment = async (
  accountId: string,
  organizationId: string,
  body: CreateBalanceAdjustmentRequest,
): Promise<BalanceAdjustment> => {
  const response = await apiClient.post<BalanceAdjustment>(
    `/accounts/${accountId}/balance-adjustments`,
    body,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};

/** Lista os ajustes de saldo (não excluídos) de uma conta, mais recentes primeiro. */
export const listBalanceAdjustments = async (
  accountId: string,
  organizationId: string,
): Promise<BalanceAdjustment[]> => {
  const response = await apiClient.get<BalanceAdjustment[]>(
    `/accounts/${accountId}/balance-adjustments`,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};

/**
 * Feed da org (todas as contas) num intervalo — para o extrato/calendário.
 * `from`/`to` em "YYYY-MM-DD" (inclusivos); ordem crescente por data.
 */
export const listOrgBalanceAdjustments = async (
  organizationId: string,
  from?: string,
  to?: string,
): Promise<BalanceAdjustment[]> => {
  const response = await apiClient.get<BalanceAdjustment[]>('/balance-adjustments', {
    params: { organization_id: organizationId, from, to },
  });
  return response.data;
};

/**
 * Corrige uma âncora existente. Só os campos enviados mudam.
 *
 * Existe porque a pergunta "antes ou depois dos lançamentos do dia?" é obrigatória e
 * fácil de errar no automático — e errar nela produz saldo errado sem nada na tela
 * denunciando. Sem edição, a saída seria excluir e refazer, redigitando tudo.
 */
export const updateBalanceAdjustment = async (
  adjustmentId: string,
  organizationId: string,
  body: UpdateBalanceAdjustmentRequest,
): Promise<BalanceAdjustment> => {
  const response = await apiClient.patch<BalanceAdjustment>(
    `/balance-adjustments/${adjustmentId}`,
    body,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};

/** Exclui (soft-delete) um ajuste de saldo → reverte o efeito no saldo. */
export const deleteBalanceAdjustment = async (
  adjustmentId: string,
  organizationId: string,
): Promise<void> => {
  await apiClient.delete(`/balance-adjustments/${adjustmentId}`, {
    params: { organization_id: organizationId },
  });
};
