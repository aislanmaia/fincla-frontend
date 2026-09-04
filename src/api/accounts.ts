// api/accounts.ts
import apiClient from './client';
import { toAmount } from './money';
import type {
  Account,
  CreateAccountRequest,
  RawAccount,
  UpdateAccountRequest,
} from './types';

/**
 * `initial_balance` vem na forma canônica `{amount, currency}` (fincla-api#130).
 * A conversão vive AQUI, na fronteira, e não nos consumidores: `AdjustBalanceModal`
 * faz `Number(account.initial_balance)`, que num objeto dá `NaN` — e NaN atravessa a
 * tela inteira sem erro nenhum, mostrando "R$ NaN" no lugar do saldo de abertura.
 *
 * Piso em zero (`toAmount`, não `toFiniteNumber`): saldo de abertura ausente é zero
 * por definição no backend (`initial_balance: Decimal("0")`), então aqui zero não é
 * inventado — é o que o campo significa.
 */
const normalizeAccount = (raw: RawAccount): Account => ({
  ...raw,
  initial_balance: toAmount(raw?.initial_balance),
});

/** Lista as contas de uma organização (ativas por padrão). */
export const listAccounts = async (
  organizationId: string,
  includeInactive = false,
): Promise<Account[]> => {
  const response = await apiClient.get<RawAccount[]>('/accounts', {
    params: { organization_id: organizationId, include_inactive: includeInactive },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeAccount) : [];
};

/** Cria uma nova conta. `organization_id` vai como query param (contrato do backend). */
export const createAccount = async (
  organizationId: string,
  body: CreateAccountRequest,
): Promise<Account> => {
  const response = await apiClient.post<RawAccount>('/accounts', body, {
    params: { organization_id: organizationId },
  });
  return normalizeAccount(response.data);
};

/** Atualiza uma conta existente. */
export const updateAccount = async (
  accountId: string,
  organizationId: string,
  body: UpdateAccountRequest,
): Promise<Account> => {
  const response = await apiClient.patch<RawAccount>(`/accounts/${accountId}`, body, {
    params: { organization_id: organizationId },
  });
  return normalizeAccount(response.data);
};

/** Desativa (soft-delete) uma conta. */
export const deactivateAccount = async (
  accountId: string,
  organizationId: string,
): Promise<Account> => {
  const response = await apiClient.delete<RawAccount>(`/accounts/${accountId}`, {
    params: { organization_id: organizationId },
  });
  return normalizeAccount(response.data);
};
