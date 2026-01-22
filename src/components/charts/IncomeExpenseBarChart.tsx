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
    // #region agent log
    const totalExpenses = data.reduce((acc, item) => acc + item.expenses, 0);
    const totalIncome = data.reduce((acc, item) => acc + item.income, 0);
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IncomeExpenseBarChart.tsx:41',message:'chartData memo entry',data:{dataLength:data.length,data,totalExpenses,totalIncome},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
          borderRadius: 4,
          skipNull: true,
          order: 2, // Despesas aparecem primeiro (mais à esquerda)
        },
        {
          label: 'Despesas',
          data: expensesData,
          backgroundColor: '#F87171',
          barPercentage,
          categoryPercentage,
          maxBarThickness,
          borderRadius: 4,
          skipNull: true,
          order: 1, // Despesas aparecem primeiro (mais à esquerda)
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
        <BarChart3 className="w-4 h-4 text-gray-400" />
      </div>
      <div className="chart-container">
        <Bar
          data={chartData}
          options={{
            ...barChartOptions,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index' as const,
              intersect: false,
            },
            scales: {
              ...barChartOptions.scales,
              x: {
                ...barChartOptions.scales?.x,
                stacked: false, // Barras lado a lado, não empilhadas
                grid: {
                  display: false,
                },
                ticks: {
                  autoSkip: false,
                }
              },
              y: {
                ...barChartOptions.scales?.y,
                stacked: false, // Barras lado a lado, não empilhadas
                beginAtZero: true,
                border: {
                  display: false
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)',
                },
                min: 0,
                ticks: {
                  ...barChartOptions.scales?.y?.ticks,
                  stepSize: undefined,
                }
              }
            },
            plugins: {
              ...barChartOptions.plugins,
              tooltip: {
                ...barChartOptions.plugins?.tooltip,
                filter: () => true,
                mode: 'index' as const,
                intersect: false,
              },
              legend: {
                ...barChartOptions.plugins?.legend,
                onClick: (e, legendItem, legend) => {
                  // Permitir clicar na legenda para mostrar/ocultar datasets
                  const index = legendItem.datasetIndex ?? 0;
                  const chart = legend.chart;
                  const meta = chart.getDatasetMeta(index);
                  meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                  chart.update();
                }
              }
            }
          }}
        />
      </div>
    </Card>
  );
});
