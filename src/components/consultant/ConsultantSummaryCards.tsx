import { ArrowDown, Wallet, TrendingUp, Users, ListOrdered } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { ConsultantSummaryResponse } from '@/types/api';

interface ConsultantSummaryCardsProps {
  summary: ConsultantSummaryResponse | undefined;
  isLoading?: boolean;
}

export function ConsultantSummaryCards({ summary, isLoading }: ConsultantSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-balance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Balanço</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary?.balance ?? 0)}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Wallet className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-income">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Receitas</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary?.total_income ?? 0)}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-expense">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Despesas</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {formatCurrency(summary?.total_expenses ?? 0)}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <ArrowDown className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-savings" role="group" aria-label="Total de transações">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Transações</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {summary?.total_transactions ?? 0}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <ListOrdered className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-balance" role="group" aria-label="Total de clientes">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/90 mb-1">Clientes</p>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-3xl font-semibold text-white">
                {summary?.organizations_count ?? 0}
              </p>
            )}
          </div>
          <div className="bg-white/20 p-3 rounded-xl ring-1 ring-white/40">
            <Users className="text-white w-6 h-6" />
          </div>
        </div>
      </Card>
    </div>
  );
}
