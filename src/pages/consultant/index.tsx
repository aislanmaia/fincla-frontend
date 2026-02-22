import { useDateRange } from '@/hooks/useDateRange';
import { useConsultantSummary, useConsultantClients } from '@/hooks/useConsultantData';
import { DateRangePicker } from '@/components/DateRangePicker';
import { ConsultantSummaryCards } from '@/components/consultant/ConsultantSummaryCards';
import { ConsultantClientList } from '@/components/consultant/ConsultantClientList';
import { PageTransition } from '@/components/PageTransition';
import { format } from 'date-fns';

export default function ConsultantDashboard() {
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

  const { data: summary, isLoading: summaryLoading } = useConsultantSummary(params);
  const { data: clientsData, isLoading: clientsLoading } = useConsultantClients();

  const clients = clientsData?.clients ?? [];

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
