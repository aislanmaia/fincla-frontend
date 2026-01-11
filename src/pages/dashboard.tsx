import { useState, useEffect } from 'react';
import { TrendingUp, User, AlertCircle } from 'lucide-react';
import { SummaryCards } from '@/components/SummaryCards';
import { Suspense, lazy } from 'react';
const ExpensePieChart = lazy(() => import('@/components/charts/ExpensePieChart').then(m => ({ default: m.ExpensePieChart })));
const IncomeExpenseBarChart = lazy(() => import('@/components/charts/IncomeExpenseBarChart').then(m => ({ default: m.IncomeExpenseBarChart })));
const WeekdayStackedBarChart = lazy(() => import('@/components/charts/WeekdayStackedBarChart').then(m => ({ default: m.WeekdayStackedBarChart })));
import { RecentTransactions } from '@/components/RecentTransactions';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useAIChat } from '@/hooks/useAIChat';
import { useDateRange } from '@/hooks/useDateRange';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/PageTransition';
import { DateRangePicker } from '@/components/DateRangePicker';

export default function Dashboard() {
  const [chartsLoading, setChartsLoading] = useState(true);
  
  // Gerenciar período selecionado (padrão: este mês)
  const { dateRange, setDateRange: setDateRangeFromHook } = useDateRange('thisMonth');
  
  // Wrapper para compatibilidade com DateRangePicker
  const handleDateRangeChange = (range: { from: Date; to: Date } | undefined) => {
    setDateRangeFromHook(range);
  };

  const {
    summary,
    expenseCategories,
    monthlyData,
    recentTransactions,
    weeklyExpenseHeatmap,
    loading,
    error,
  } = useFinancialData(dateRange);

  const { processUserMessage } = useAIChat();

  // Simulate chart loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendChatMessage = async (message: string) => {
    await processUserMessage(message, () => { });
    // Note: Data refresh will happen automatically via React Query
  };

  const handleRetry = () => {
    // Data will auto-refresh via React Query invalidation
    window.location.reload();
  };

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px]">
        {/* Loading State */}
        {loading && (
          <div className="mb-8 p-4 bg-[#E6F0F6] supports-[backdrop-filter]:bg-[#E6F0F6]/80 backdrop-blur border border-[#00C6B8]/30 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-[#00C6B8]/30 border-t-[#00A89C] rounded-full animate-spin"></div>
              <span className="text-sm text-[#00A89C]">Carregando dados financeiros...</span>
            </div>
          </div>
        )}

        {/* Seletor de Período - acima dos cards, à direita */}
        <div className="mb-6 flex justify-end">
          <DateRangePicker 
            value={dateRange}
            onChange={handleDateRangeChange}
          />
        </div>

        {/* Summary Cards em grid Bento inicial */}
        <SummaryCards summary={summary} monthlyData={monthlyData} isLoading={loading} dateRange={dateRange} />

        {/* Bento Grid: 12 colunas em XL, alturas balanceadas e cards com sombras/gradientes */}
        <div className="grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-12 gap-6 xl:gap-8">
          {/* Receitas vs Despesas - card largo */}
          <div className="lg:col-span-6 xl:col-span-8 order-2 lg:order-none">
            <Suspense fallback={<div className="h-[320px] xl:h-[380px] 2xl:h-[420px] rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 animate-pulse" />}>
              <IncomeExpenseBarChart data={monthlyData} isLoading={chartsLoading} />
            </Suspense>
          </div>
          {/* Pizza - card alto com gradiente leve */}
          <div className="lg:col-span-6 xl:col-span-4 order-1 lg:order-none">
            <Suspense fallback={<div className="h-[320px] xl:h-[360px] 2xl:h-[380px] rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 animate-pulse" />}>
              <ExpensePieChart data={expenseCategories} isLoading={chartsLoading} />
            </Suspense>
          </div>
        </div>

        {/* Segunda fileira Bento */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-6 xl:grid-cols-12 gap-6 xl:gap-8">
          <div className="lg:col-span-6 xl:col-span-8">
            <Suspense fallback={<div className="h-[360px] xl:h-[380px] 2xl:h-[420px] rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 animate-pulse" />}>
              <WeekdayStackedBarChart data={weeklyExpenseHeatmap} isLoading={chartsLoading} />
            </Suspense>
          </div>
          <div className="lg:col-span-6 xl:col-span-4">
            <RecentTransactions transactions={recentTransactions} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

