import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IncomeExpenseBarChart } from '@/components/charts/IncomeExpenseBarChart';
import { ConsultantEmptyState } from '@/components/consultant/ConsultantEmptyState';
import type { CashFlowResponse } from '@/types/api';

interface CashFlowChartProps {
  data?: CashFlowResponse;
  isLoading?: boolean;
}

export function CashFlowChart({ data, isLoading }: CashFlowChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.monthly_data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantEmptyState
            icon={TrendingUp}
            title="Nenhum dado de fluxo de caixa"
            description="Registre receitas e despesas para visualizar o fluxo de caixa consolidado dos seus clientes."
          />
        </CardContent>
      </Card>
    );
  }

  // Transform data for the bar chart
  const chartData = data.monthly_data.map((item) => ({
    month: item.month,
    income: item.total_income,
    expenses: item.total_expenses,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Caixa</CardTitle>
      </CardHeader>
      <CardContent>
        <IncomeExpenseBarChart data={chartData} />
      </CardContent>
    </Card>
  );
}
