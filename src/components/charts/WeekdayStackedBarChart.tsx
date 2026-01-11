import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WeeklyExpenseHeatmap } from '@/hooks/useFinancialData';
import { generateDistinctCategoryColors } from '@/lib/colorGenerator';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Props = {
  data: WeeklyExpenseHeatmap;
  isLoading?: boolean;
};

export function WeekdayStackedBarChart({ data, isLoading = false }: Props) {
  const [period, setPeriod] = React.useState('semana');
  const chartData = React.useMemo(() => {
    if (!data || !data.data) {
      return { labels: [], datasets: [] };
    }
    
    // Gerar cores distintas para todas as categorias
    const colorMap = generateDistinctCategoryColors(data.categories);
    
    // Construir datasets por categoria (colunas da matriz)
    const datasets = data.categories.map((category, categoryIdx) => ({
      label: category,
      backgroundColor: colorMap.get(category) || '#6B7280',
      data: data.data.map((dayRow) => dayRow[categoryIdx] || 0),
      stack: 'stack-0',
      borderRadius: 6,
      barPercentage: 0.72,
      categoryPercentage: 0.62,
    }));
    return { labels: data.days, datasets };
  }, [data]);

  const options: ChartOptions<'bar'> = React.useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          // Esconde itens com valor 0 no tooltip
          filter: (item) => (typeof item.parsed?.y === 'number' ? item.parsed.y > 0 : true),
          callbacks: {
            label: (ctx) => {
              const val = typeof ctx.parsed?.y === 'number' ? ctx.parsed.y : 0;
              return ` ${ctx.dataset.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            },
          },
        },
      },
      responsive: true,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => `R$ ${Number(v).toLocaleString('pt-BR')}` } },
      },
    }),
    []
  );

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0 bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Gastos por Dia da Semana</h3>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="h-[320px] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-top-indigo-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl shadow-flat border-0 bg-white">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Gastos por Dia da Semana</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-auto h-9 text-sm border-gray-300 rounded-full px-3 dark:border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="h-[320px]">
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  );
}

export default WeekdayStackedBarChart;


