import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTransactions } from '@/api/transactions';
import { useOrganization } from './useOrganization';
import { processTransactionAnalytics } from '@/lib/analytics';
import type { Transaction as ApiTransaction } from '@/types/api';

export interface FinancialSummary {
  balance: number;
  income: number;
  expenses: number;
  savingsGoal?: number;
  savingsProgress?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  type: 'income' | 'expense';
  icon: string;
}

export interface ExpenseCategory {
  name: string;
  amount: number;
  color: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface MoneyFlowNode {
  id: string;
  name: string;
  category: 'income' | 'expense' | 'balance';
  type?: 'regular' | 'goal' | 'investment' | 'debt';
}

export interface MoneyFlowLink {
  source: string;
  target: string;
  value: number;
}

export interface MoneyFlow {
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
}

export interface WeeklyExpenseHeatmap {
  categories: string[];
  days: string[];
  data: number[][];
}

export interface DailyTransaction {
  category: string;
  amount: number;
  description: string;
}

export interface DailyTransactions {
  monday: DailyTransaction[];
  tuesday: DailyTransaction[];
  wednesday: DailyTransaction[];
  thursday: DailyTransaction[];
  friday: DailyTransaction[];
  saturday: DailyTransaction[];
  sunday: DailyTransaction[];
}

/**
 * Hook principal para dados financeiros
 * Carrega transações do backend e processa analytics no frontend
 */
export function useFinancialData() {
  const { activeOrgId } = useOrganization();

  // Estados para dados processados (inicializados vazios)
  const [summary, setSummary] = useState<FinancialSummary>({ balance: 0, income: 0, expenses: 0 });
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlow>({ nodes: [], links: [] });
  const [weeklyExpenseHeatmap, setWeeklyExpenseHeatmap] = useState<WeeklyExpenseHeatmap>({ categories: [], days: [], data: [] });
  const [dailyTransactions, setDailyTransactions] = useState<DailyTransactions>({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });

  // Carregar transações do backend (sempre que tiver organização ativa)
  const { data: backendTransactions, isLoading, error: queryError } = useQuery({
    queryKey: ['financial-data', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      return await listTransactions({ organization_id: activeOrgId });
    },
    enabled: !!activeOrgId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Processar dados quando transações do backend mudarem
  useEffect(() => {
    if (backendTransactions && backendTransactions.length > 0) {
      // Filtrar por organização ativa
      const orgTransactions = backendTransactions.filter(
        (t) => t.organization_id === activeOrgId
      );

      // Processar analytics
      const analytics = processTransactionAnalytics(orgTransactions);

      setSummary(analytics.summary);
      setMonthlyData(analytics.monthly);
      setExpenseCategories(analytics.categories);
      setMoneyFlow(analytics.moneyFlow);
      setWeeklyExpenseHeatmap(analytics.heatmap);

      // Converter transações para formato do componente
      const formattedTransactions: Transaction[] = orgTransactions
        .slice(0, 5)
        .map((t) => ({
          id: t.id.toString(),
          description: t.description,
          amount: t.type === 'income' ? t.value : -t.value,
          category: t.category,
          date: new Date(t.date),
          type: t.type,
          icon: t.type === 'income' ? 'building' : 'shopping-cart',
        }));

      setRecentTransactions(formattedTransactions);
    } else if (backendTransactions && backendTransactions.length === 0) {
      // Sem transações: definir valores zerados
      setSummary({ balance: 0, income: 0, expenses: 0 });
      setExpenseCategories([]);
      setMonthlyData([]);
      setRecentTransactions([]);
      setMoneyFlow({ nodes: [], links: [] });
      setWeeklyExpenseHeatmap({ categories: [], days: [], data: [] });
    }
  }, [backendTransactions, activeOrgId]);

  const error = queryError ? String(queryError) : null;

  return {
    summary,
    expenseCategories,
    monthlyData,
    recentTransactions,
    moneyFlow,
    weeklyExpenseHeatmap,
    dailyTransactions,
    loading: isLoading,
    error,
  };
}
