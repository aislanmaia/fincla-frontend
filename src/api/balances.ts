// api/balances.ts
import apiClient from './client';
import type { OrgBalances, AccountBalance, BalanceSummary } from './types';

/** Saldo realizado por conta + total da org (só contas include_in_total). */
export const getOrgBalances = async (
  organizationId: string,
  atDate?: string,
): Promise<OrgBalances> => {
  const response = await apiClient.get<OrgBalances>('/balances', {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return response.data;
};

/** Rollup da org: total disponível, total geral e breakdown por tipo. */
export const getBalanceSummary = async (
  organizationId: string,
  atDate?: string,
): Promise<BalanceSummary> => {
  const response = await apiClient.get<BalanceSummary>('/balances/summary', {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return response.data;
};

/** Saldo realizado de uma conta específica. */
export const getAccountBalance = async (
  accountId: string,
  organizationId: string,
  atDate?: string,
): Promise<AccountBalance> => {
  const response = await apiClient.get<AccountBalance>(`/balances/${accountId}`, {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return response.data;
};
