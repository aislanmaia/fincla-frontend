import { useQuery } from '@tanstack/react-query';
import {
  getConsultantSummary,
  getConsultantClients,
  getFinancialHealthIndex,
  getActiveGoalsCount,
  getTotalCreditCardDebt,
  getCashFlow,
  getExpensesByCategory,
  getIncomeCommitment,
  getGoalsProgressByType,
  getClientsAtRisk,
} from '@/api/consultant';
import type {
  ConsultantSummaryQuery,
  ActiveGoalsCountQuery,
  TotalCreditCardDebtQuery,
  CashFlowQuery,
  ExpensesByCategoryQuery,
  IncomeCommitmentQuery,
  GoalsProgressByTypeQuery,
  ClientsAtRiskQuery,
} from '@/types/api';

export function useConsultantSummary(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-summary', params?.date_start, params?.date_end],
    queryFn: () => getConsultantSummary(params),
    retry: false,
  });
}

export function useConsultantClients() {
  return useQuery({
    queryKey: ['consultant-clients'],
    queryFn: getConsultantClients,
    retry: false,
  });
}

export function useFinancialHealthIndex(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-financial-health', params?.date_start, params?.date_end],
    queryFn: () => getFinancialHealthIndex(params),
    retry: false,
  });
}

export function useActiveGoalsCount(params?: ActiveGoalsCountQuery) {
  return useQuery({
    queryKey: ['consultant-active-goals', params?.as_of_date],
    queryFn: () => getActiveGoalsCount(params),
    retry: false,
  });
}

export function useTotalCreditCardDebt(params?: TotalCreditCardDebtQuery) {
  return useQuery({
    queryKey: ['consultant-credit-card-debt', params?.as_of_date],
    queryFn: () => getTotalCreditCardDebt(params),
    retry: false,
  });
}

export function useCashFlow(params?: CashFlowQuery) {
  return useQuery({
    queryKey: ['consultant-cash-flow', params?.date_start, params?.date_end],
    queryFn: () => getCashFlow(params),
    retry: false,
  });
}

export function useExpensesByCategory(params?: ExpensesByCategoryQuery) {
  return useQuery({
    queryKey: ['consultant-expenses-category', params?.date_start, params?.date_end],
    queryFn: () => getExpensesByCategory(params),
    retry: false,
  });
}

export function useIncomeCommitment(params?: IncomeCommitmentQuery) {
  return useQuery({
    queryKey: ['consultant-income-commitment', params?.date_start, params?.date_end],
    queryFn: () => getIncomeCommitment(params),
    retry: false,
  });
}

export function useGoalsProgressByType(params?: GoalsProgressByTypeQuery) {
  return useQuery({
    queryKey: ['consultant-goals-progress', params?.as_of_date],
    queryFn: () => getGoalsProgressByType(params),
    retry: false,
  });
}

export function useClientsAtRisk(params?: ClientsAtRiskQuery) {
  return useQuery({
    queryKey: ['consultant-clients-at-risk', params?.as_of_date, params?.limit],
    queryFn: () => getClientsAtRisk(params),
    retry: false,
  });
}
