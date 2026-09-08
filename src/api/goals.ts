// api/goals.ts
// Alvo, saldo, aporte e a série da projeção chegam na forma canônica
// `{amount, currency}` (fincla-api#134). `unwrapMoney` desembrulha em qualquer
// profundidade — a série da projeção é um array de dinheiro, e enumerar campo a
// campo é onde se esquece um: `v / maxY` sobre o objeto vira NaN e o gráfico some.
import apiClient from './client';
import { unwrapMoney } from './money';
import type {
  Goal,
  GoalProjection,
  CreateGoalRequest,
  UpdateGoalRequest,
  GoalContribution,
  CreateGoalContributionRequest,
  GoalContributionListResponse,
} from './types';

/**
 * Cria uma nova meta financeira
 */
export const createGoal = async (
  goal: CreateGoalRequest
): Promise<Goal> => {
  const response = await apiClient.post<Goal>('/goals', goal);
  return unwrapMoney(response.data);
};

/**
 * Lista todas as metas de uma organização
 */
export const listGoals = async (
  organizationId: string
): Promise<Goal[]> => {
  const response = await apiClient.get<Goal[]>('/goals', {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

/**
 * Obtém detalhes de uma meta específica
 */
export const getGoal = async (
  goalId: string,
  organizationId: string
): Promise<Goal> => {
  const response = await apiClient.get<Goal>(`/goals/${goalId}`, {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

/**
 * Projeção de conclusão da meta (M4). Overrides opcionais p/ simular outro cenário.
 */
export const getGoalProjection = async (
  organizationId: string,
  goalId: string,
  overrides?: { monthly_contribution?: number; annual_return_rate?: number },
): Promise<GoalProjection> => {
  const response = await apiClient.get<GoalProjection>(`/goals/${goalId}/projection`, {
    params: { organization_id: organizationId, ...overrides },
  });
  return unwrapMoney(response.data);
};

/**
 * Atualiza uma meta existente
 */
export const updateGoal = async (
  goalId: string,
  organizationId: string,
  data: UpdateGoalRequest
): Promise<Goal> => {
  const response = await apiClient.put<Goal>(
    `/goals/${goalId}`,
    data,
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Remove uma meta financeira
 */
export const deleteGoal = async (
  goalId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/goals/${goalId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Registra uma contribuição para uma meta.
 * O campo current_amount da meta é incrementado automaticamente.
 */
export const contributeToGoal = async (
  goalId: string,
  organizationId: string,
  data: CreateGoalContributionRequest
): Promise<GoalContribution> => {
  const response = await apiClient.post<GoalContribution>(
    `/goals/${goalId}/contributions`,
    data,
    { params: { organization_id: organizationId } }
  );
  return unwrapMoney(response.data);
};

/**
 * Lista o histórico de contribuições de uma meta com paginação
 */
export const listGoalContributions = async (
  goalId: string,
  organizationId: string,
  page = 1,
  limit = 20
): Promise<GoalContributionListResponse> => {
  const response = await apiClient.get<GoalContributionListResponse>(
    `/goals/${goalId}/contributions`,
    { params: { organization_id: organizationId, page, limit } }
  );
  return unwrapMoney(response.data);
};
