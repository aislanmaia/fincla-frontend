import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsultantEmptyState } from '@/components/consultant/ConsultantEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import type { GoalsProgressByTypeResponse } from '@/types/api';

interface GoalsProgressChartProps {
  data?: GoalsProgressByTypeResponse;
  isLoading?: boolean;
}

// Helper to translate goal names to Portuguese
const translateGoalName = (name: string): string => {
  const translations: Record<string, string> = {
    reserva_emergencia: 'Reserva de Emergência',
    viagem: 'Viagem',
    carro: 'Carro',
    casa: 'Casa',
    educação: 'Educação',
    investimento: 'Investimento',
    aposentadoria: 'Aposentadoria',
    outro: 'Outros',
  };
  return translations[name] || name;
};

export function GoalsProgressChart({ data, isLoading }: GoalsProgressChartProps) {
  
  // Get color based on progress
  const getProgressColor = (progress: number) => {
    if (progress >= 70) return 'bg-green-500';
    if (progress >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Progresso das Metas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.by_type.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Progresso das Metas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantEmptyState
            icon={Target}
            title="Nenhum dado de metas"
            description="Os clientes ainda não criaram metas. Quando definirem metas, o progresso aparecerá aqui."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Progresso das Metas
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({data.organizations_count} {data.organizations_count === 1 ? 'cliente' : 'clientes'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.by_type.map((goalType, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{translateGoalName(goalType.goal_name)}</span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{goalType.avg_progress.toFixed(1)}%</span>
                  <span className="text-xs">({goalType.count} {goalType.count === 1 ? 'meta' : 'metas'})</span>
                </div>
              </div>
              <Progress 
                value={goalType.avg_progress} 
                className="h-3"
                // Note: The Progress component uses default color, 
                // for custom colors we'd need to override with CSS or className
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
