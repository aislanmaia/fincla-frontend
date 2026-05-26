// api/recurringSeries.ts — modelo novo (guia: materialização lazy via GET /transactions)
import apiClient from './client';
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
  return response.data;
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
  return response.data;
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
