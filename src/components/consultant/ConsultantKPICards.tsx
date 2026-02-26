import { Heart, CreditCard, Target, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { 
  ConsultantSummaryResponse,
  FinancialHealthIndexResponse,
  TotalCreditCardDebtResponse,
  ActiveGoalsCountResponse
} from '@/types/api';

interface ConsultantKPICardsProps {
  summary?: ConsultantSummaryResponse;
  healthIndex?: FinancialHealthIndexResponse;
  creditCardDebt?: TotalCreditCardDebtResponse;
  activeGoals?: ActiveGoalsCountResponse;
  isLoading?: boolean;
}

export function ConsultantKPICards({ 
  summary, 
  healthIndex, 
  creditCardDebt, 
  activeGoals,
  isLoading 
}: ConsultantKPICardsProps) {
  
  // Get health index label and color based on score
  const getHealthLabel = (index: number) => {
    if (index >= 70) return 'Saudável';
    if (index >= 40) return 'Atenção';
    return 'Risco';
  };

  const count = summary?.organizations_count ?? 0;
  const healthIdx = healthIndex?.index ?? 0;
  const debt = creditCardDebt?.total_debt ?? 0;
  const goalsCount = activeGoals?.active_goals_count ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Card 1: Total de Clientes */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-clients">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90 mb-1">Total de Clientes</p>
            {isLoading ? (
              <Skeleton className="h-8 w-28 bg-white/30" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {count} {count === 1 ? 'Cliente Ativo' : 'Clientes Ativos'}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Users className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Card 2: Índice de Saúde Financeira Médio */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-health">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90 mb-1">Índice de Saúde Financeira Médio</p>
            {isLoading ? (
              <Skeleton className="h-8 w-28 bg-white/30" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {healthIdx.toFixed(1)}/100 ({getHealthLabel(healthIdx)})
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Heart className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Card 3: Dívida Total em Cartões (Base) */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-debt">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90 mb-1">Dívida Total em Cartões (Base)</p>
            {isLoading ? (
              <Skeleton className="h-8 w-32 bg-white/30" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {formatCurrency(debt)}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <CreditCard className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      {/* Card 4: Metas de Economia em Progresso */}
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-goals">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90 mb-1">Metas de Economia em Progresso</p>
            {isLoading ? (
              <Skeleton className="h-8 w-28 bg-white/30" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {goalsCount} {goalsCount === 1 ? 'Meta Ativa' : 'Metas Ativas'}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Target className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>
    </div>
  );
}
