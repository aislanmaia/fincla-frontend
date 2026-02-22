import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useDateRange } from '@/hooks/useDateRange';
import { useConsultantSummary, useConsultantClients } from '@/hooks/useConsultantData';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ConsultantSummaryCards } from '@/components/consultant/ConsultantSummaryCards';
import { ConsultantClientList } from '@/components/consultant/ConsultantClientList';
import { PageTransition } from '@/components/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/api/client';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';

export default function ConsultantDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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

  useEffect(() => {
    const err = summaryError || clientsError;
    if (!err) return;
    const status = isAxiosError(err) ? err.response?.status : null;
    if (status === 403) {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar a área do consultor.',
        variant: 'destructive',
      });
      setLocation('/');
    } else if (err) {
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
        {/* Seletor de Período */}
        <div className="mb-6 flex justify-end">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>

        {/* Cards de Resumo Consolidado */}
        <ConsultantSummaryCards summary={summary} isLoading={summaryLoading} />

        {/* Lista de Clientes */}
        <div className="mt-8">
          <ConsultantClientList clients={clients} isLoading={clientsLoading} />
        </div>
      </div>
    </PageTransition>
  );
}
