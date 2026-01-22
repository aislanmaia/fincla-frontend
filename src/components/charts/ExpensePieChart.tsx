import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart } from 'lucide-react';
import { chartColors, pieChartOptions } from '@/lib/chartConfig';
import { ExpenseCategory } from '@/hooks/useFinancialData';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExpensePieChartProps {
  data: ExpenseCategory[];
  isLoading?: boolean;
}

export const ExpensePieChart = React.memo(({ data, isLoading }: ExpensePieChartProps) => {
  const chartData = React.useMemo(() => ({
    labels: data.map(item => item.name),
    datasets: [{
      data: data.map(item => item.amount),
      backgroundColor: data.map(item => item.color),
      borderWidth: 0
    }]
  }), [data]);

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0 gradient-card-blue">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Despesas por Categoria</h3>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="chart-container flex items-center justify-center min-h-[240px]">
          <div className="loading-spinner w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  // Se não há dados, mostrar mensagem
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0 gradient-card-blue">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Despesas por Categoria</h3>
          <PieChart className="w-4 h-4 text-gray-400" />
        </div>
        <div className="chart-container flex items-center justify-center min-h-[240px]">
          <p className="text-sm text-gray-500">Nenhuma despesa no período selecionado</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl shadow-flat border-0 gradient-card-blue">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Despesas por Categoria</h3>
        <PieChart className="w-4 h-4 text-gray-400" />
      </div>
      <div className="chart-container">
        <Doughnut data={chartData} options={pieChartOptions} />
      </div>
    </Card>
  );
});
