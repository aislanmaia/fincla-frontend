import apiClient from './client';
import type {
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
