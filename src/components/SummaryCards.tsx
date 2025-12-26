import { ArrowUp, ArrowDown, Wallet, Target, TrendingUp, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FinancialSummary, MonthlyData } from '@/hooks/useFinancialData';
import { Skeleton } from '@/components/ui/skeleton';
import { memo, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';

interface SummaryCardsProps {
  summary: FinancialSummary;
  monthlyData?: MonthlyData[];
  isLoading?: boolean;
  isEmpty?: boolean;
}

/**
 * Calcula a porcentagem de mudança entre o mês atual e o mês anterior
 * Retorna null se não houver dados suficientes para comparar
 */
function calculateMonthChange(
  monthlyData: MonthlyData[] | undefined,
  getValue: (data: MonthlyData) => number
): { percentage: number; isPositive: boolean } | null {
  if (!monthlyData || monthlyData.length < 2) {
    return null;
  }

  // Os dados já vêm ordenados por data do analytics.ts (groupByMonth)
  // Pegar os dois últimos meses (mais recentes)
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];

  const currentValue = getValue(currentMonth);
  const previousValue = getValue(previousMonth);

  // Se o mês anterior for zero, não podemos calcular porcentagem
  if (previousValue === 0) {
    return null;
  }

  const percentage = ((currentValue - previousValue) / previousValue) * 100;
  return {
    percentage: Math.abs(percentage),
    isPositive: percentage >= 0,
  };
}

export const SummaryCards = memo(function SummaryCards({ summary, monthlyData, isLoading, isEmpty }: SummaryCardsProps) {
  // Calcular mudanças percentuais
  const balanceChange = useMemo(() => {
    if (!monthlyData || monthlyData.length < 2) return null;
    // Os dados já vêm ordenados por data do analytics.ts
    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];
    const currentBalance = current.income - current.expenses;
    const previousBalance = previous.income - previous.expenses;
    if (previousBalance === 0) return null;
    const percentage = ((currentBalance - previousBalance) / Math.abs(previousBalance)) * 100;
    return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
  }, [monthlyData]);

  const incomeChange = useMemo(() => calculateMonthChange(monthlyData, (data) => data.income), [monthlyData]);
  const expenseChange = useMemo(() => calculateMonthChange(monthlyData, (data) => data.expenses), [monthlyData]);

  // Se não há dados, mostrar estado vazio simplificado
  if (isEmpty && !isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 rounded-2xl shadow-flat border-0 bg-gradient-to-br from-gray-50 to-gray-100 col-span-full">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <Info className="w-5 h-5" />
            <p className="text-sm">Nenhuma transação encontrada. Crie sua primeira transação para visualizar o resumo financeiro.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Balance Card */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-balance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Saldo Total</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary.balance)}
              </p>
            )}
            {!isLoading && (
              <p className="text-sm text-white/90 flex items-center mt-2">
                {balanceChange ? (
                  <>
                    {balanceChange.isPositive ? (
                      <ArrowUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-1" />
                    )}
                    {balanceChange.isPositive ? '+' : '-'}{balanceChange.percentage.toFixed(1).replace('.', ',')}% este mês
                  </>
                ) : (
                  <span className="text-white/70">Sem dados para comparar</span>
                )}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Wallet className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Income Card */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-income">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Receitas</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary.income)}
              </p>
            )}
            {!isLoading && (
              <p className="text-sm text-white/90 flex items-center mt-2">
                {incomeChange ? (
                  <>
                    {incomeChange.isPositive ? (
                      <ArrowUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-1" />
                    )}
                    {incomeChange.isPositive ? '+' : '-'}{incomeChange.percentage.toFixed(1).replace('.', ',')}% este mês
                  </>
                ) : (
                  <span className="text-white/70">Sem dados para comparar</span>
                )}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Expenses Card */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-expense">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Despesas</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary.expenses)}
              </p>
            )}
            {!isLoading && (
              <p className="text-sm text-white/90 flex items-center mt-2">
                {expenseChange ? (
                  <>
                    {expenseChange.isPositive ? (
                      <ArrowUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-1" />
                    )}
                    {expenseChange.isPositive ? '+' : '-'}{expenseChange.percentage.toFixed(1).replace('.', ',')}% este mês
                  </>
                ) : (
                  <span className="text-white/70">Sem dados para comparar</span>
                )}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <ArrowDown className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Savings Goal Card */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-savings">
        <div className="flex items-center justify-between">
          <div className="w-full">
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Meta de Economia</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : summary.savingsGoal !== undefined ? (
              <p className="text-3xl font-semibold text-white">{formatCurrency(summary.savingsGoal)}</p>
            ) : (
              <p className="text-xl font-semibold text-white/70">Não definida</p>
            )}
            <div className="mt-2">
              {isLoading ? (
                <Skeleton className="h-2 w-full rounded-full" />
              ) : summary.savingsProgress !== undefined ? (
                <>
                  <Progress value={summary.savingsProgress} className="h-3 rounded-full bg-white/30" indicatorClassName="bg-white" />
                  <p className="text-xs text-white/90 mt-1">{summary.savingsProgress}% da meta</p>
                </>
              ) : (
                <p className="text-xs text-white/70">Defina uma meta na página de Metas</p>
              )}
            </div>
          </div>
          <div className="bg-white/20 p-3 rounded-xl ml-4 ring-1 ring-white/40">
            <Target className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>
    </div>
  );
});

