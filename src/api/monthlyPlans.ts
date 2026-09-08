// api/monthlyPlans.ts
// Planejado, realizado e variação chegam na forma canônica `{amount, currency}`
// (fincla-api#134). `unwrapMoney` desembrulha em qualquer profundidade — inclusive
// dentro de `items[]`, onde a variação pode ser negativa.
import apiClient from './client';
import { unwrapMoney } from './money';
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
  return unwrapMoney(r.data);
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
  return unwrapMoney(r.data);
};
