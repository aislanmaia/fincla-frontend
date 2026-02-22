import { useQuery } from '@tanstack/react-query';
import { getConsultantSummary, getConsultantClients } from '@/api/consultant';
import type { ConsultantSummaryQuery } from '@/types/api';

export function useConsultantSummary(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-summary', params?.date_start, params?.date_end],
    queryFn: () => getConsultantSummary(params),
  });
}

export function useConsultantClients() {
  return useQuery({
    queryKey: ['consultant-clients'],
    queryFn: getConsultantClients,
  });
}
