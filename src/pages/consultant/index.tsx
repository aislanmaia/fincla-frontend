import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';
import {
  useConsultantSummary,
  useFinancialHealthIndex,
  useActiveGoalsCount,
  useTotalCreditCardDebt,
  useCashFlow,
  useExpensesByCategory,
  useGoalsProgressByType,
  useClientsAtRisk,
} from '@/hooks/useConsultantData';
import { ConsultantKPICards } from '@/components/consultant/ConsultantKPICards';
import { ConsultantDateControls } from '@/components/consultant/ConsultantDateControls';
import { ClientsAtRiskList } from '@/components/consultant/ClientsAtRiskList';
import { CashFlowChart } from '@/components/consultant/CashFlowChart';
import { ExpensesByCategoryChart } from '@/components/consultant/ExpensesByCategoryChart';
import { GoalsProgressChart } from '@/components/consultant/GoalsProgressChart';
import { PageTransition } from '@/components/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { CONSULTANT_403_KEY } from '@/lib/permissions';
import { handleApiError } from '@/api/client';

export default function ConsultantDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const errorHandledRef = useRef(false);

  // State for date controls
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: firstDayOfMonth, to: today };
  });
  const [snapshotDate, setSnapshotDate] = useState<Date | undefined>(new Date());

  // Build query params for period-based endpoints (date_start, date_end)
  const periodParams = dateRange?.from
    ? {
        date_start: format(dateRange.from, 'yyyy-MM-dd'),
        date_end: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd'),
      }
    : undefined;

  // Build query params for snapshot-based endpoints (as_of_date)
  const snapshotParam = snapshotDate
    ? { as_of_date: format(snapshotDate, 'yyyy-MM-dd') }
    : undefined;

  // Fetch all consultant data
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useConsultantSummary(periodParams);
  const { data: healthIndex, isLoading: healthLoading } = useFinancialHealthIndex(periodParams);
  const { data: creditCardDebt, isLoading: debtLoading } = useTotalCreditCardDebt(snapshotParam);
  const { data: activeGoals, isLoading: goalsLoading } = useActiveGoalsCount(snapshotParam);
  const { data: cashFlowData, isLoading: cashFlowLoading } = useCashFlow(periodParams);
  const { data: expensesData, isLoading: expensesLoading } = useExpensesByCategory(periodParams);
  const { data: goalsProgress, isLoading: goalsProgressLoading } = useGoalsProgressByType(snapshotParam);
  const { data: clientsAtRisk, isLoading: atRiskLoading } = useClientsAtRisk({ ...snapshotParam, limit: 10 });
  
  const isLoading = summaryLoading || healthLoading || debtLoading || goalsLoading || 
    cashFlowLoading || expensesLoading || goalsProgressLoading || atRiskLoading;

  useEffect(() => {
    if (!summaryError) {
      errorHandledRef.current = false;
      return;
    }
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    const err = summaryError;
    const status = isAxiosError(err) ? err.response?.status : null;
    if (status === 403) {
      sessionStorage.setItem(CONSULTANT_403_KEY, '1');
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
  }, [summaryError, toast, setLocation]);

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px]">
        {/* Date Controls */}
        <div className="mb-6">
          <ConsultantDateControls
            dateRange={dateRange}
            snapshotDate={snapshotDate}
            onDateRangeChange={setDateRange}
            onSnapshotDateChange={setSnapshotDate}
          />
        </div>

        {/* KPI Cards */}
        <ConsultantKPICards
          summary={summary}
          healthIndex={healthIndex}
          creditCardDebt={creditCardDebt}
          activeGoals={activeGoals}
          isLoading={isLoading}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <CashFlowChart data={cashFlowData} isLoading={cashFlowLoading} />
          <ExpensesByCategoryChart data={expensesData} isLoading={expensesLoading} />
        </div>

        {/* Goals Progress */}
        <GoalsProgressChart data={goalsProgress} isLoading={goalsProgressLoading} />

        {/* Clients at Risk */}
        <ClientsAtRiskList data={clientsAtRisk} isLoading={atRiskLoading} />
      </div>
    </PageTransition>
  );
}
