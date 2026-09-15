// api/subscriptions.ts
import apiClient from './client';
import {
  CancelSubscriptionResponse,
  ChangePlanRequest,
  ChangePlanResponse,
  AnnualSettlementOperation,
  AnnualSettlementRequest,
  Subscription,
} from './types';

/**
 * Retorna a assinatura do usuário autenticado, com o plano embedado e as
 * últimas faturas (mesma forma usada para renderizar /profile/billing).
 */
export const getCurrentSubscription = async (): Promise<Subscription> => {
  const response = await apiClient.get<Subscription>('/subscriptions/me');
  return response.data;
};

/**
 * Inicia mudança de plano. Quando o backend devolve ``checkout_url``, o
 * frontend deve redirecionar o usuário para essa URL (hosted checkout da
 * ASAAS). Quando ``checkout_url`` é ``null``, a mudança já foi aplicada
 * (update reusing payment method on file).
 */
export const changePlan = async (
  data: ChangePlanRequest
): Promise<ChangePlanResponse> => {
  const response = await apiClient.post<ChangePlanResponse>(
    '/subscriptions/change-plan',
    data
  );
  return response.data;
};

/**
 * Quotes and records an annual change request. This endpoint never receives
 * card data and does not claim that an unavailable provider update succeeded.
 */
export const requestAnnualSettlement = async (
  data: AnnualSettlementRequest,
): Promise<AnnualSettlementOperation> => {
  const response = await apiClient.post<AnnualSettlementOperation>(
    "/subscriptions/annual-settlement",
    data,
  );
  return response.data;
};

/**
 * Cancela a assinatura. O acesso continua liberado até ``effective_until``
 * (igual a ``current_period_end``).
 */
export const cancelSubscription = async (): Promise<CancelSubscriptionResponse> => {
  const response = await apiClient.post<CancelSubscriptionResponse>(
    '/subscriptions/cancel'
  );
  return response.data;
};
