// api/recurringSeries.ts — modelo novo (guia: materialização lazy via GET /transactions)
import apiClient from './client';
import { toFiniteNumber } from './money';
import type {
  RecurringSeries,
  RecurringSeriesListResponse,
  ListRecurringSeriesParams,
  CreateRecurringSeriesRequest,
  UpdateRecurringSeriesRequest,
  RecurringSeriesToggleRequest,
  ChangeSeriesValueRequest,
  ChangeSeriesValueResponse,
} from './types';

export const createRecurringSeries = async (
  organizationId: string,
  data: CreateRecurringSeriesRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.post<RecurringSeries>('/recurring-series', data, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

export const listRecurringSeries = async (
  organizationId: string,
  params?: ListRecurringSeriesParams,
): Promise<RecurringSeriesListResponse> => {
  const response = await apiClient.get<RecurringSeriesListResponse>('/recurring-series', {
    params: {
      organization_id: organizationId,
      ...(params?.isActive !== undefined ? { is_active: params.isActive } : {}),
      ...(params?.dateStart && params?.dateEnd
        ? { date_start: params.dateStart, date_end: params.dateEnd }
        : {}),
    },
  });
  // `value` é `Decimal` no schema e chega como string. Sem converter aqui, o card
  // "Próximos Débitos" somava com `reduce((s, d) => s + d.value, 0)` e concatenava:
  // `0 + "120.00"` → `"0120.00"`, e o total virava NaN. Ver fincla-frontend#88.
  const raw = response.data as unknown as RecurringSeriesListResponse & {
    series?: Array<Record<string, unknown>>;
  };
  // Os SOMATÓRIOS também são Decimal — e alimentam o KPI "Comprometido" do
  // dashboard, que faz aritmética com eles.
  const money = (o: Record<string, unknown> | undefined, campos: string[]) =>
    o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, campos.includes(k) ? toFiniteNumber(v) : v])) : o;

  return {
    ...raw,
    series: Array.isArray(raw?.series)
      ? raw.series.map((s) => ({ ...s, value: toFiniteNumber(s?.value) }))
      : [],
    summary: money(raw?.summary as unknown as Record<string, unknown> | undefined,
      ['total_monthly_expense', 'total_monthly_income', 'total_expense', 'total_income']),
    summary_for_period: money(raw?.summary_for_period as unknown as Record<string, unknown> | undefined,
      ['total_expense', 'total_income']),
  } as unknown as RecurringSeriesListResponse;
};

export interface RecurringProjectionItem {
  series_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  type: 'income' | 'expense';
  description: string;
  category: string;
}

export interface RecurringProjectionResponse {
  items: RecurringProjectionItem[];
}

/**
 * Returns future recurring occurrences (strictly after today, up to date_end).
 * Past occurrences are not included — they are materialized into transactions
 * and already counted as realized values.
 */
export const getRecurringProjection = async (
  organizationId: string,
  dateStart: string,
  dateEnd: string,
): Promise<RecurringProjectionResponse> => {
  const response = await apiClient.get<RecurringProjectionResponse>('/recurring-series/projection', {
    params: { organization_id: organizationId, date_start: dateStart, date_end: dateEnd },
  });
  // Mesma razão: `value` da projeção também é `Decimal` no backend.
  const raw = response.data as unknown as { items?: Array<Record<string, unknown>> };
  return {
    items: Array.isArray(raw?.items)
      ? raw.items.map((i) => ({ ...i, value: toFiniteNumber(i?.value) }))
      : [],
  } as RecurringProjectionResponse;
};

export const getRecurringSeries = async (
  seriesId: string,
  organizationId: string,
): Promise<RecurringSeries> => {
  const response = await apiClient.get<RecurringSeries>(`/recurring-series/${seriesId}`, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

export const updateRecurringSeries = async (
  seriesId: string,
  organizationId: string,
  data: UpdateRecurringSeriesRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.patch<RecurringSeries>(
    `/recurring-series/${seriesId}`,
    data,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};

export const deleteRecurringSeries = async (
  seriesId: string,
  organizationId: string,
): Promise<void> => {
  await apiClient.delete(`/recurring-series/${seriesId}`, {
    params: { organization_id: organizationId },
  });
};

export const toggleRecurringSeries = async (
  seriesId: string,
  organizationId: string,
  body: RecurringSeriesToggleRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.patch<RecurringSeries>(
    `/recurring-series/${seriesId}/toggle`,
    body,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};

export const changeRecurringSeriesValue = async (
  seriesId: string,
  organizationId: string,
  data: ChangeSeriesValueRequest,
): Promise<ChangeSeriesValueResponse> => {
  const response = await apiClient.post<ChangeSeriesValueResponse>(
    `/recurring-series/${seriesId}/change-value`,
    data,
    { params: { organization_id: organizationId } },
  );
  return response.data;
};
