// api/financialHealth.ts
import apiClient from './client';
import type { EconomyCapacity } from './types';

/** Capacidade de economia (sobra média mensal + tendência) por competência. */
export const getEconomyCapacity = async (
  organizationId: string,
  months = 3,
): Promise<EconomyCapacity> => {
  const response = await apiClient.get<EconomyCapacity>('/financial-health/economy-capacity', {
    params: { organization_id: organizationId, months },
  });
  return response.data;
};
