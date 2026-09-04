// api/balanceAdjustments.ts
import apiClient from './client';
import { toAmount } from './money';
import type {
  BalanceAdjustment,
  CreateBalanceAdjustmentRequest,
  RawBalanceAdjustment,
  UpdateBalanceAdjustmentRequest,
} from './types';

/**
 * `amount` e `asserted_balance` vêm na forma canônica `{amount, currency}`
 * (fincla-api#130), na moeda DA CONTA — o ajuste não guarda moeda própria.
 *
 * A conversão vive na fronteira porque os consumidores somam: o extrato e o
 * calendário fazem `s + a.amount`, e `0 + {…}` em JavaScript vira a string
 * `"0[object Object]"` sem erro nenhum. É o fincla-frontend#88 com outra roupa.
 */
const normalizeAdjustment = (raw: RawBalanceAdjustment): BalanceAdjustment => ({
  ...raw,
  amount: toAmount(raw?.amount),
  asserted_balance: toAmount(raw?.asserted_balance),
});

const normalizeList = (raw: RawBalanceAdjustment[]): BalanceAdjustment[] =>
  Array.isArray(raw) ? raw.map(normalizeAdjustment) : [];

/** Cria um ajuste de saldo (reconciliação) numa conta. */
export const createBalanceAdjustment = async (
  accountId: string,
  organizationId: string,
  body: CreateBalanceAdjustmentRequest,
): Promise<BalanceAdjustment> => {
  const response = await apiClient.post<RawBalanceAdjustment>(
    `/accounts/${accountId}/balance-adjustments`,
    body,
    { params: { organization_id: organizationId } },
  );
  return normalizeAdjustment(response.data);
};

/** Lista os ajustes de saldo (não excluídos) de uma conta, mais recentes primeiro. */
export const listBalanceAdjustments = async (
  accountId: string,
  organizationId: string,
): Promise<BalanceAdjustment[]> => {
  const response = await apiClient.get<RawBalanceAdjustment[]>(
    `/accounts/${accountId}/balance-adjustments`,
    { params: { organization_id: organizationId } },
  );
  return normalizeList(response.data);
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
  const response = await apiClient.get<RawBalanceAdjustment[]>('/balance-adjustments', {
    params: { organization_id: organizationId, from, to },
  });
  return normalizeList(response.data);
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
  const response = await apiClient.patch<RawBalanceAdjustment>(
    `/balance-adjustments/${adjustmentId}`,
    body,
    { params: { organization_id: organizationId } },
  );
  return normalizeAdjustment(response.data);
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
