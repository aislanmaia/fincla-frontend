// api/transfers.ts
import apiClient from './client';
import type { Transfer, CreateTransferRequest } from './types';

/** Cria uma transferência entre contas próprias da org. */
export const createTransfer = async (
  organizationId: string,
  body: CreateTransferRequest,
): Promise<Transfer> => {
  const response = await apiClient.post<Transfer>('/transfers', body, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

/** Lista transferências da org (opcionalmente filtradas por conta). */
export const listTransfers = async (
  organizationId: string,
  accountId?: string,
): Promise<Transfer[]> => {
  const response = await apiClient.get<Transfer[]>('/transfers', {
    params: { organization_id: organizationId, account_id: accountId },
  });
  return response.data;
};

/** Remove uma transferência. */
export const deleteTransfer = async (
  transferId: string,
  organizationId: string,
): Promise<void> => {
  await apiClient.delete(`/transfers/${transferId}`, {
    params: { organization_id: organizationId },
  });
};
