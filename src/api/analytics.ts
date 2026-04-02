// api/analytics.ts
import apiClient from './client';
import type {
  MonthlyEvolutionResponse,
  ByCategoryResponse,
  SpendingRhythmResponse,
  PeriodComparisonResponse,
  SpendingByDayResponse,
} from './types';

/**
 * Evolução mensal de receitas, despesas e saldo ao longo dos últimos N meses
 */
export const getMonthlyEvolution = async (
  organizationId: string,
  months = 6
): Promise<MonthlyEvolutionResponse> => {
  const response = await apiClient.get<MonthlyEvolutionResponse>(
    '/analytics/monthly-evolution',
    { params: { organization_id: organizationId, months } }
  );
  return response.data;
};

/**
 * Distribuição de gastos (ou receitas) por categoria/tag para um período
 */
export const getByCategory = async (
  organizationId: string,
  options?: {
    dateStart?: string;
    dateEnd?: string;
    transactionType?: 'expense' | 'income';
  }
): Promise<ByCategoryResponse> => {
  const response = await apiClient.get<ByCategoryResponse>(
    '/analytics/by-category',
    {
      params: {
        organization_id: organizationId,
        date_start: options?.dateStart,
        date_end: options?.dateEnd,
        transaction_type: options?.transactionType ?? 'expense',
      },
    }
  );
  return response.data;
};

/**
 * Ritmo de gastos por categoria ao longo de vários meses
 */
export const getSpendingRhythm = async (
  organizationId: string,
  months = 6
): Promise<SpendingRhythmResponse> => {
  const response = await apiClient.get<SpendingRhythmResponse>(
    '/analytics/spending-rhythm',
    { params: { organization_id: organizationId, months } }
  );
  return response.data;
};

/**
 * Série diária no intervalo (ritmo / gráfico no modal Nova transação).
 */
export const getSpendingByDay = async (
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  options?: { tagId?: string; transactionType?: 'expense' | 'income' }
): Promise<SpendingByDayResponse> => {
  const response = await apiClient.get<SpendingByDayResponse>(
    '/analytics/spending-by-day',
    {
      params: {
        organization_id: organizationId,
        date_start: dateStart,
        date_end: dateEnd,
        ...(options?.tagId ? { tag_id: options.tagId } : {}),
        ...(options?.transactionType
          ? { transaction_type: options.transactionType }
          : {}),
      },
    }
  );
  return response.data;
};

/**
 * Compara dois períodos (A vs B) mostrando variação percentual
 */
export const getPeriodComparison = async (
  organizationId: string,
  periodAStart: string,
  periodAEnd: string,
  periodBStart: string,
  periodBEnd: string
): Promise<PeriodComparisonResponse> => {
  const response = await apiClient.get<PeriodComparisonResponse>(
    '/analytics/period-comparison',
    {
      params: {
        organization_id: organizationId,
        period_a_start: periodAStart,
        period_a_end: periodAEnd,
        period_b_start: periodBStart,
        period_b_end: periodBEnd,
      },
    }
  );
  return response.data;
};

/**
 * Exporta transações filtradas em formato CSV.
 * Retorna o arquivo diretamente como Blob.
 */
export const exportTransactionsCsv = async (
  organizationId: string,
  options?: {
    dateStart?: string;
    dateEnd?: string;
    type?: string;
    paymentMethod?: string;
    statusFilter?: string;
    tagId?: string;
  }
): Promise<Blob> => {
  const response = await apiClient.get('/analytics/export-csv', {
    params: {
      organization_id: organizationId,
      date_start: options?.dateStart,
      date_end: options?.dateEnd,
      type: options?.type,
      payment_method: options?.paymentMethod,
      status_filter: options?.statusFilter,
      tag_id: options?.tagId,
    },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Utilitário: baixa o CSV como arquivo no navegador
 */
export const downloadTransactionsCsv = async (
  organizationId: string,
  options?: {
    dateStart?: string;
    dateEnd?: string;
    type?: string;
    paymentMethod?: string;
    statusFilter?: string;
    tagId?: string;
  },
  filename = 'transactions.csv'
): Promise<void> => {
  const blob = await exportTransactionsCsv(organizationId, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
