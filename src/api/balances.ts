// api/balances.ts
import apiClient from './client';
import { toFiniteNumber } from './money';
import type {
  OrgBalances,
  AccountBalance,
  BalanceSummary,
  RawOrgBalances,
  RawAccountBalance,
  RawBalanceSummary,
} from './types';


/**
 * Os tipos `Raw*` existem para o compilador cobrar a normalização.
 *
 * Sem eles, `apiClient.get<BalanceSummary>` já declarava número na entrada e um
 * `return response.data` cru compilava sem erro — foi assim que `getAccountBalance`
 * passou pela primeira rodada com o tipo corrigido e o corpo intacto: o tipo virou
 * mentira em silêncio. Com `Raw*` na entrada e o tipo normalizado na saída, esquecer
 * a conversão passa a ser erro de compilação, não bug de produção.
 */
const normalizeBalanceSummary = (raw: RawBalanceSummary): BalanceSummary => ({
  ...raw,
  total_available: toFiniteNumber(raw?.total_available),
  total_all: toFiniteNumber(raw?.total_all),
  by_type: Array.isArray(raw?.by_type)
    ? raw.by_type.map((t) => ({ ...t, balance: toFiniteNumber(t?.balance) }))
    : [],
});

const normalizeAccountBalance = (raw: RawAccountBalance): AccountBalance => ({
  ...raw,
  initial_balance: toFiniteNumber(raw?.initial_balance),
  balance: toFiniteNumber(raw?.balance),
});

/** Saldo realizado por conta + total da org (só contas include_in_total). */
export const getOrgBalances = async (
  organizationId: string,
  atDate?: string,
): Promise<OrgBalances> => {
  const response = await apiClient.get<RawOrgBalances>('/balances', {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return {
    ...response.data,
    total: toFiniteNumber(response.data?.total),
    accounts: Array.isArray(response.data?.accounts)
      ? response.data.accounts.map(normalizeAccountBalance)
      : [],
  };
};

/** Rollup da org: total disponível, total geral e breakdown por tipo. */
export const getBalanceSummary = async (
  organizationId: string,
  atDate?: string,
): Promise<BalanceSummary> => {
  const response = await apiClient.get<RawBalanceSummary>('/balances/summary', {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return normalizeBalanceSummary(response.data);
};

/** Saldo realizado de uma conta específica. */
export const getAccountBalance = async (
  accountId: string,
  organizationId: string,
  atDate?: string,
): Promise<AccountBalance> => {
  const response = await apiClient.get<RawAccountBalance>(`/balances/${accountId}`, {
    params: { organization_id: organizationId, at_date: atDate },
  });
  return normalizeAccountBalance(response.data);
};
