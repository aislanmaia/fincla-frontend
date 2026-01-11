import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import { chartColors, barChartOptions } from '@/lib/chartConfig';
import { MonthlyData } from '@/hooks/useFinancialData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface IncomeExpenseBarChartProps {
  data: MonthlyData[];
  isLoading?: boolean;
}

export const IncomeExpenseBarChart = React.memo(({ data, isLoading }: IncomeExpenseBarChartProps) => {
  // Detectar tamanho da tela para ajustar barras responsivamente
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const chartData = React.useMemo(() => {
    // Lógica para centralizar barras quando há poucos dados
    let labels = data.map(item => item.month);

    // Se tiver poucos dados, adiciona apenas 1 slot de cada lado para centralizar sem espremer
    const shouldPad = data.length > 0 && data.length < 5;

    // Helper para gerar dados com padding
    const getPaddedData = (accessor: (item: MonthlyData) => number) => {
      if (!shouldPad) return data.map(accessor);

      // Adiciona apenas 1 slot vazio de cada lado
      return [null, ...data.map(accessor), null];
    };

    // Aplicar padding nas labels se necessário
    if (shouldPad) {
      labels = ['', ...labels, ''];
    }

    // Ajustar configurações baseado no tamanho da tela
    const isSmallScreen = windowWidth < 768; // mobile
    const isMediumScreen = windowWidth >= 768 && windowWidth < 1024; // tablet
    const isLargeScreen = windowWidth >= 1024; // desktop
    
    // Configurações responsivas para evitar sobreposição em telas menores
    // mas manter barras proporcionais em telas maiores
    const barPercentage = isSmallScreen ? 0.6 : isMediumScreen ? 0.75 : 0.85;
    const categoryPercentage = isSmallScreen ? 0.5 : isMediumScreen ? 0.65 : 0.75;
    const maxBarThickness = isSmallScreen ? 60 : isMediumScreen ? 100 : 120;
    
    const expensesData = getPaddedData(item => item.expenses);
    const incomeData = getPaddedData(item => item.income);

    return {
      labels,
      datasets: [
        {
          label: 'Receitas',
          data: incomeData,
          backgroundColor: '#10B981',
          barPercentage,
          categoryPercentage,
          maxBarThickness,
          // Não usar barThickness fixo - deixar Chart.js calcular automaticamente
          borderRadius: 4,
          skipNull: true,
          // Barras agrupadas (lado a lado) para garantir que ambas sejam sempre visíveis
        },
        {
          label: 'Despesas',
          data: expensesData,
          backgroundColor: '#F87171',
          barPercentage,
          categoryPercentage,
          maxBarThickness,
          // Não usar barThickness fixo - deixar Chart.js calcular automaticamente
          borderRadius: 4,
          skipNull: true,
          // Barras agrupadas (lado a lado) para garantir que ambas sejam sempre visíveis
        }
      ]
    };
  }, [data, windowWidth]);

  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0 gradient-card-indigo">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Receitas vs Despesas</h3>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="chart-container flex items-center justify-center min-h-[240px]">
          <div className="loading-spinner w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl shadow-flat border-0 gradient-card-indigo">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Receitas vs Despesas</h3>
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <Select defaultValue="this-year">
            <SelectTrigger className="w-auto h-9 text-sm border-gray-300 rounded-full px-3 dark:border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-year">Este ano</SelectItem>
              <SelectItem value="last-year">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="chart-container">
        <Bar
          data={chartData}
          options={{
            ...barChartOptions,
            maintainAspectRatio: false,
            scales: {
              ...barChartOptions.scales,
              x: {
                ...barChartOptions.scales?.x,
                // Não usar stacked para barras agrupadas
                grid: {
                  display: false,
                }
              },
              y: {
                ...barChartOptions.scales?.y,
                // Não usar stacked para barras agrupadas
                beginAtZero: true,
                border: {
                  display: false
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                },
                // Garantir que valores pequenos sejam visíveis
                min: 0,
                ticks: {
                  ...barChartOptions.scales?.y?.ticks,
                  // Não limitar o número de ticks para garantir que valores pequenos sejam visíveis
                  stepSize: undefined,
                }
              }
            },
            // Garantir que todas as barras sejam renderizadas, mesmo valores pequenos
            plugins: {
              ...barChartOptions.plugins,
              tooltip: {
                ...barChartOptions.plugins?.tooltip,
                // Sempre mostrar tooltip, mesmo para valores pequenos
                filter: () => true,
              }
            }
          }}
        />
      </div>
    </Card>
  );
});
