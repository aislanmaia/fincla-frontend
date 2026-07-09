import apiClient from './client';
import type {
  ClientHealthResponse,
  ConsultantSummaryQuery,
  ConsultantSummaryResponse,
  ConsultantClientsResponse,
  ActiveGoalsCountQuery,
  ActiveGoalsCountResponse,
  TotalCreditCardDebtQuery,
  TotalCreditCardDebtResponse,
  CashFlowQuery,
  CashFlowResponse,
  ExpensesByCategoryQuery,
  ExpensesByCategoryResponse,
  IncomeCommitmentQuery,
  IncomeCommitmentResponse,
  GoalsProgressByTypeQuery,
  GoalsProgressByTypeResponse,
  ClientsAtRiskQuery,
  ClientsAtRiskResponse,
  FinancialHealthIndexResponse,
  AiEvaluationRequest,
  AiEvaluationResponse,
} from './types';

export const getConsultantSummary = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/summary',
    { params }
  );
  return response.data;
};

export const getConsultantClients = async (): Promise<ConsultantClientsResponse> => {
  const response = await apiClient.get<ConsultantClientsResponse>(
    '/consultant/clients'
  );
  return response.data;
};

export const getConsultantConsolidatedReport = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/reports/consolidated',
    { params }
  );
  return response.data;
};

export const getFinancialHealthIndex = async (
  params?: ConsultantSummaryQuery
): Promise<FinancialHealthIndexResponse> => {
  const response = await apiClient.get<FinancialHealthIndexResponse>(
    '/consultant/financial-health-index',
    { params }
  );
  return response.data;
};

/**
 * Força o recálculo do snapshot canônico de saúde de UM cliente.
 *
 * A carteira preenche as lacunas sozinha, mas com teto por request; este endpoint
 * é a saída explícita do consultor quando o score está velho ou ainda pendente.
 * Depois de um 200, invalide a query da carteira para o anel refletir o número novo.
 */
export const recomputeClientHealth = async (organizationId: string): Promise<ClientHealthResponse> => {
  const response = await apiClient.post<ClientHealthResponse>(
    `/consultant/clients/${organizationId}/health/recompute`
  );
  return response.data;
};

export const getActiveGoalsCount = async (
  params?: ActiveGoalsCountQuery
): Promise<ActiveGoalsCountResponse> => {
  const response = await apiClient.get<ActiveGoalsCountResponse>(
    '/consultant/active-goals-count',
    { params }
  );
  return response.data;
};

export const getTotalCreditCardDebt = async (
  params?: TotalCreditCardDebtQuery
): Promise<TotalCreditCardDebtResponse> => {
  const response = await apiClient.get<TotalCreditCardDebtResponse>(
    '/consultant/total-credit-card-debt',
    { params }
  );
  return response.data;
};

export const getCashFlow = async (
  params?: CashFlowQuery
): Promise<CashFlowResponse> => {
  const response = await apiClient.get<CashFlowResponse>(
    '/consultant/cash-flow',
    { params }
  );
  return response.data;
};

export const getExpensesByCategory = async (
  params?: ExpensesByCategoryQuery
): Promise<ExpensesByCategoryResponse> => {
  const response = await apiClient.get<ExpensesByCategoryResponse>(
    '/consultant/expenses-by-category',
    { params }
  );
  return response.data;
};

export const getIncomeCommitment = async (
  params?: IncomeCommitmentQuery
): Promise<IncomeCommitmentResponse> => {
  const response = await apiClient.get<IncomeCommitmentResponse>(
    '/consultant/income-commitment',
    { params }
  );
  return response.data;
};

export const getGoalsProgressByType = async (
  params?: GoalsProgressByTypeQuery
): Promise<GoalsProgressByTypeResponse> => {
  const response = await apiClient.get<GoalsProgressByTypeResponse>(
    '/consultant/goals-progress-by-type',
    { params }
  );
  return response.data;
};

export const getClientsAtRisk = async (
  params?: ClientsAtRiskQuery
): Promise<ClientsAtRiskResponse> => {
  const response = await apiClient.get<ClientsAtRiskResponse>(
    '/consultant/clients-at-risk',
    { params }
  );
  return response.data;
};

// ── Adicionar cliente (S5) ──────────────────────────────────────

export interface CreateConsultantClientPayload {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  occupation?: string;
  org_name?: string;
  org_type?: string;
  estimated_income?: string;
  initial_balance?: string;
  card?: { bank?: string; limit?: string; due_day?: string } | null;
  income?: { description?: string; value?: string; day?: string } | null;
  notes?: string;
  tags?: string[];
  experience_level?: string;
  main_goal?: string;
  priority?: boolean;
}

export interface CreateConsultantClientResponse {
  organization_id: string;
  client_name: string;
  set_password_link: string;
}

export const createConsultantClient = async (
  payload: CreateConsultantClientPayload
): Promise<CreateConsultantClientResponse> => {
  const response = await apiClient.post<CreateConsultantClientResponse>(
    '/consultant/clients',
    payload
  );
  return response.data;
};

export const regenerateClientActivationLink = async (
  organizationId: string
): Promise<{ set_password_link: string }> => {
  const response = await apiClient.post<{ set_password_link: string }>(
    `/consultant/clients/${organizationId}/activation-link`,
    {}
  );
  return response.data;
};

export interface ConsultantClientProfile {
  organization_id: string;
  has_profile: boolean;
  notes: string | null;
  tags: string[];
  experience_level: string | null;
  main_goal: string | null;
  priority: boolean;
  phone: string | null;
  occupation: string | null;
  estimated_income: string | null;
}

/** The consultant's private profile (notes/tags/…) for one client org. */
export const getConsultantClientProfile = async (
  organizationId: string
): Promise<ConsultantClientProfile> => {
  const response = await apiClient.get<ConsultantClientProfile>(
    `/consultant/clients/${organizationId}/profile`
  );
  return response.data;
};

export interface ConsultantQuota {
  limit: number;
  used: number;
  remaining: number;
}

/** Plan client quota: how many clients the consultant may still add. */
export const getConsultantQuota = async (): Promise<ConsultantQuota> => {
  const response = await apiClient.get<ConsultantQuota>('/consultant/quota');
  return response.data;
};

// ===== Consultor IA — A1 ("Avaliar com IA") =====

/**
 * Gera o `correlation_id` da avaliação.
 *
 * Precisa ser um **UUID**: o backend responde `400` para um `X-Request-Id`
 * malformado (ele não substitui o id em silêncio, senão cada retry geraria um
 * correlation_id novo e a run cara re-executaria). `crypto.randomUUID` exige
 * secure context; o fallback cobre http:// em dev e jsdom antigo.
 */
export const newEvaluationRequestId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * O backend tem budget de wall-clock de ~55s (`LLM_TOTAL_BUDGET_SECONDS`) e
 * ainda roda tools + audit por cima. O timeout de write padrão do `apiClient`
 * (30s) abortaria a avaliação no meio, então esta chamada pede mais folga.
 */
const AI_EVALUATION_TIMEOUT_MS = 90_000;

/**
 * `POST /v1/consultant/clients/{organization_id}/ai-evaluation` — roda a Skill
 * `evaluate-client` contra UM cliente. Requer a feature `consultant_ai`.
 *
 * O escopo do tenant vem do path + sessão autenticada, nunca do body.
 *
 * `requestId` é ecoado como `correlation_id` em todas as respostas (sucesso e
 * erro) e é a **chave de idempotência**: repetir o mesmo id devolve `409`.
 * Para um retry legítimo, gere um novo id com `newEvaluationRequestId()`.
 */
export const evaluateClientWithAi = async (
  organizationId: string,
  requestId: string,
  body: AiEvaluationRequest = {}
): Promise<AiEvaluationResponse> => {
  const response = await apiClient.post<AiEvaluationResponse>(
    `/consultant/clients/${organizationId}/ai-evaluation`,
    body,
    {
      headers: { 'X-Request-Id': requestId },
      timeout: AI_EVALUATION_TIMEOUT_MS,
    }
  );
  return response.data;
};
