// api/monthlyPlans.ts
import apiClient from './client';
import type { MonthlyPlanComparison, MonthlyPlanUpsertBody } from './types';

/** Comparação Planejado × Realizado do mês (M5). */
export const getMonthlyPlan = async (
  organizationId: string,
  year: number,
  month: number,
): Promise<MonthlyPlanComparison> => {
  const r = await apiClient.get<MonthlyPlanComparison>(`/monthly-plans/${year}/${month}`, {
    params: { organization_id: organizationId },
  });
  return r.data;
};

/** Cria/atualiza o plano do mês (substitui itens) e devolve a comparação. */
export const upsertMonthlyPlan = async (
  organizationId: string,
  year: number,
  month: number,
  body: MonthlyPlanUpsertBody,
): Promise<MonthlyPlanComparison> => {
  const r = await apiClient.put<MonthlyPlanComparison>(`/monthly-plans/${year}/${month}`, body, {
    params: { organization_id: organizationId },
  });
  return r.data;
};
