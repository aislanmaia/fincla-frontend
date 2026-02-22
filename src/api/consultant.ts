import apiClient from './client';
import type {
  ConsultantSummaryQuery,
  ConsultantSummaryResponse,
  ConsultantClientsResponse,
} from '../types/api';

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
