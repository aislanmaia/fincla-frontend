import { useEffect, useRef } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useDateRange } from '@/hooks/useDateRange';
import { useConsultantSummary, useConsultantClients } from '@/hooks/useConsultantData';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ConsultantSummaryCards } from '@/components/consultant/ConsultantSummaryCards';
import { ConsultantClientList } from '@/components/consultant/ConsultantClientList';
import { PageTransition } from '@/components/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isConsultant } from '@/lib/consultant';
import { handleApiError } from '@/api/client';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';

export default function ConsultantDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const errorHandledRef = useRef(false);
  const { dateRange, setDateRange: setDateRangeFromHook } = useDateRange('thisMonth');

  const handleDateRangeChange = (range: { from: Date; to: Date } | undefined) => {
    setDateRangeFromHook(range);
  };

  const params = dateRange
    ? {
        date_start: format(dateRange.from, 'yyyy-MM-dd'),
        date_end: format(dateRange.to, 'yyyy-MM-dd'),
      }
    : undefined;

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useConsultantSummary(params);
  const { data: clientsData, isLoading: clientsLoading, error: clientsError } = useConsultantClients();

  const clients = clientsData?.clients ?? [];

  if (!isConsultant(user)) {
    return <Redirect to="/" />;
  }

  useEffect(() => {
    if (!summaryError && !clientsError) {
      errorHandledRef.current = false;
      return;
    }
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    const err = summaryError || clientsError;
    const status = isAxiosError(err) ? err.response?.status : null;
    if (status === 403) {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar a área do consultor.',
        variant: 'destructive',
      });
      setLocation('/');
    } else {
      toast({
        title: 'Erro ao carregar dados',
        description: handleApiError(err),
        variant: 'destructive',
      });
    }
  }, [summaryError, clientsError, toast, setLocation]);

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px]">
        <div className="mb-6 flex justify-end">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>

        <ConsultantSummaryCards summary={summary} isLoading={summaryLoading} />

        <div className="mt-8">
          <ConsultantClientList clients={clients} isLoading={clientsLoading} />
        </div>
      </div>
    </PageTransition>
  );
}
