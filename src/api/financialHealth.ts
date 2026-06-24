// api/financialHealth.ts
import apiClient from './client';
import type { EconomyCapacity, FinancialHealth } from './types';

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

/** Painel de saúde financeira (M7) — ativo−passivo, métricas, score. */
export const getFinancialHealth = async (organizationId: string): Promise<FinancialHealth> => {
  const r = await apiClient.get<FinancialHealth>('/financial-health/score', {
    params: { organization_id: organizationId },
  });
  return r.data;
};
