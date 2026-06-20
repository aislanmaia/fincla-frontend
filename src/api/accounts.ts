// api/accounts.ts
import apiClient from './client';
import type {
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
} from './types';

/** Lista as contas de uma organização (ativas por padrão). */
export const listAccounts = async (
  organizationId: string,
  includeInactive = false,
): Promise<Account[]> => {
  const response = await apiClient.get<Account[]>('/accounts', {
    params: { organization_id: organizationId, include_inactive: includeInactive },
  });
  return response.data;
};

/** Cria uma nova conta. `organization_id` vai como query param (contrato do backend). */
export const createAccount = async (
  organizationId: string,
  body: CreateAccountRequest,
): Promise<Account> => {
  const response = await apiClient.post<Account>('/accounts', body, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

/** Atualiza uma conta existente. */
export const updateAccount = async (
  accountId: string,
  organizationId: string,
  body: UpdateAccountRequest,
): Promise<Account> => {
  const response = await apiClient.patch<Account>(`/accounts/${accountId}`, body, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

/** Desativa (soft-delete) uma conta. */
export const deactivateAccount = async (
  accountId: string,
  organizationId: string,
): Promise<Account> => {
  const response = await apiClient.delete<Account>(`/accounts/${accountId}`, {
    params: { organization_id: organizationId },
  });
  return response.data;
};
