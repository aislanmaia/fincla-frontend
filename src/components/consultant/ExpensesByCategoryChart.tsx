import { PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ExpensePieChart } from '@/components/charts/ExpensePieChart';
import { ConsultantEmptyState } from '@/components/consultant/ConsultantEmptyState';
import type { ExpensesByCategoryResponse } from '@/types/api';
import { chartColors } from '@/lib/chartConfig';

// Convert chartColors object to array for easier indexing
const colorArray = Object.values(chartColors);

interface ExpensesByCategoryChartProps {
  data?: ExpensesByCategoryResponse;
  isLoading?: boolean;
}

export function ExpensesByCategoryChart({ data, isLoading }: ExpensesByCategoryChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantEmptyState
            icon={PieChart}
            title="Nenhum dado de despesas"
            description="Quando houver transações registradas, as despesas aparecerão aqui organizadas por categoria."
          />
        </CardContent>
      </Card>
    );
  }

  // Transform data for the pie chart - add colors from chartColors
  const chartData = data.categories.map((category, index) => ({
    name: category.name,
    amount: category.total,
    color: colorArray[index % colorArray.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ExpensePieChart data={chartData} />
      </CardContent>
    </Card>
  );
}
