// api/plans.ts
import apiClient from './client';
import { ListPlansResponse, Plan, PlanAudience } from './types';

/**
 * Lista o catálogo público de planos ativos.
 *
 * Endpoint público (sem auth) usado tanto na landing page quanto no modal
 * de comparação dentro do app. Plans com ``is_active=false`` ou
 * ``is_public=false`` são filtrados pelo backend.
 */
export const listPlans = async (
  audience: PlanAudience = 'standard'
): Promise<Plan[]> => {
  const response = await apiClient.get<ListPlansResponse>('/plans', {
    params: { audience },
  });
  return response.data.items ?? [];
};

/** Detalhe de um plano individual (mesma forma de listPlans). */
export const getPlan = async (planId: string): Promise<Plan> => {
  const response = await apiClient.get<Plan>(`/plans/${planId}`);
  return response.data;
};
