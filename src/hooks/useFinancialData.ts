import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTransactions, getTransactionsSummary } from '@/api/transactions';
import { listCreditCards, getCreditCardInvoice } from '@/api/creditCards';
import { useOrganization } from './useOrganization';
import { processTransactionAnalytics } from '@/lib/analytics';
import type { Transaction as ApiTransaction } from '@/types/api';
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from 'date-fns';

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
 * @param dateRange - Opcional: range de datas para filtrar transações
 */
export function useFinancialData(dateRange?: { from: Date; to: Date }) {
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
  // Buscar todas as transações fazendo múltiplas requisições se necessário
  const { data: backendTransactions, isLoading, error: queryError } = useQuery({
    queryKey: ['financial-data', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      
      // Buscar todas as transações paginadas
      let allTransactions: ApiTransaction[] = [];
      let page = 1;
      const limit = 100; // Máximo permitido
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await listTransactions({
            organization_id: activeOrgId,
            page,
            limit,
          });

          if (response.data && response.data.length > 0) {
            allTransactions = [...allTransactions, ...response.data];
            hasMore = response.pagination.has_next;
            page++;
          } else {
            hasMore = false;
          }
        } catch (error: any) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:119',message:'listTransactions error',data:{page,limit,organizationId:activeOrgId,errorStatus:error?.response?.status,errorMessage:error?.message,errorData:error?.response?.data,transactionsCollected:allTransactions.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          // Se for erro 422 (Unprocessable Entity) ou 404 (Not Found), 
          // provavelmente não há mais páginas - parar o loop
          // Se for outro erro, também parar para não ficar em loop infinito
          if (error?.response?.status === 422 || error?.response?.status === 404) {
            console.warn(`Erro ao buscar página ${page} de transações (${error?.response?.status}). Retornando ${allTransactions.length} transações já coletadas.`);
            hasMore = false;
          } else {
            // Para outros erros, logar e parar também
            console.error(`Erro inesperado ao buscar página ${page} de transações:`, error);
            hasMore = false;
          }
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:140',message:'all transactions collected',data:{totalTransactions:allTransactions.length,pagesProcessed:page-1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      return allTransactions;
    },
    enabled: !!activeOrgId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Buscar resumo do backend quando há dateRange (mais preciso que cálculo local)
  const { data: backendSummary } = useQuery({
    queryKey: ['transactions-summary', activeOrgId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!activeOrgId || !dateRange) return null;
      
      // Formatar datas para o formato esperado pelo backend (YYYY-MM-DD)
      // dateRange.to pode ser 2026-01-12T02:59:59.999Z, precisamos usar apenas a data
      const dateStart = format(dateRange.from, 'yyyy-MM-dd');
      const dateEnd = format(dateRange.to, 'yyyy-MM-dd');
      
      const summary = await getTransactionsSummary({
        organization_id: activeOrgId,
        date_start: dateStart,
        date_end: dateEnd,
      });
      
      return summary;
    },
    enabled: !!activeOrgId && !!dateRange,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Carregar faturas de cartão de crédito que fecham no período
  const { data: creditCardInvoicesTotal } = useQuery({
    queryKey: ['credit-card-invoices', activeOrgId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      if (!activeOrgId || !dateRange) return 0;

      try {
        // Buscar todos os cartões da organização
        const cards = await listCreditCards(activeOrgId);
        if (cards.length === 0) return 0;

        let totalInvoices = 0;

        // Para cada mês no período, buscar faturas de todos os cartões
        const months = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
        
        for (const month of months) {
          const year = month.getFullYear();
          const monthNumber = month.getMonth() + 1;

          // Buscar fatura de cada cartão para este mês
          for (const card of cards) {
            try {
              const invoice = await getCreditCardInvoice(
                card.id,
                year,
                monthNumber,
                activeOrgId
              );
              
              // If we get here, invoice exists (200 response means invoice exists with items)
              // Somar o valor total da fatura (representa o que o usuário precisa pagar)
              totalInvoices += invoice.total_amount;
            } catch (err: any) {
              // 404 means invoice doesn't exist for this month/card - skip
              if (err?.response?.status === 404) {
                continue;
              }
              // Other errors - log but continue
              console.error(`Erro ao buscar fatura do cartão ${card.id} para ${year}/${monthNumber}:`, err);
              continue;
            }
          }
        }

        return totalInvoices;
      } catch (error) {
        console.error('Erro ao buscar faturas de cartão:', error);
        return 0;
      }
    },
    enabled: !!activeOrgId && !!dateRange,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Processar dados quando transações do backend mudarem
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:241',message:'useEffect entry',data:{backendTransactionsLength:backendTransactions?.length||0,backendTransactionsIsUndefined:backendTransactions===undefined,isLoading,queryError:queryError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    if (backendTransactions && backendTransactions.length > 0) {
      // Filtrar por organização ativa
      const orgTransactions = backendTransactions.filter(
        (t) => t.organization_id === activeOrgId
      );

      // Processar analytics com filtro de data se fornecido
      // Incluir valor total das faturas de cartão de crédito que fecham no período
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:228',message:'before processTransactionAnalytics',data:{orgTransactionsCount:orgTransactions.length,dateRange:dateRange?{from:dateRange.from.toISOString(),to:dateRange.to.toISOString()}:null,creditCardInvoicesTotal:creditCardInvoicesTotal||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const analytics = processTransactionAnalytics(
        orgTransactions, 
        dateRange,
        creditCardInvoicesTotal || 0
      );
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:235',message:'after processTransactionAnalytics',data:{monthlyDataLength:analytics.monthly.length,monthlyData:analytics.monthly,summaryExpenses:analytics.summary.expenses,summaryIncome:analytics.summary.income},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Usar resumo do backend se disponível (mais preciso que cálculo local)
      // O backend já deve incluir as faturas de cartão de crédito no total_expenses
      if (backendSummary) {
        setSummary({
          balance: backendSummary.balance,
          income: backendSummary.total_income,
          expenses: backendSummary.total_expenses, // Backend já inclui faturas de cartão
        });
      } else {
        setSummary(analytics.summary);
      }
      
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:265',message:'backendTransactions empty array',data:{backendSummaryAvailable:!!backendSummary},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      // Sem transações: usar resumo do backend se disponível, senão zerar
      if (backendSummary) {
        setSummary({
          balance: backendSummary.balance,
          income: backendSummary.total_income,
          expenses: backendSummary.total_expenses, // Backend já inclui faturas de cartão
        });
      } else {
        setSummary({ balance: 0, income: 0, expenses: 0 });
      }
      setExpenseCategories([]);
      setMonthlyData([]);
      setRecentTransactions([]);
      setMoneyFlow({ nodes: [], links: [] });
      setWeeklyExpenseHeatmap({ categories: [], days: [], data: [] });
    } else if (!backendTransactions && !isLoading) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useFinancialData.ts:278',message:'backendTransactions undefined and not loading',data:{queryError:queryError?.message||null,queryErrorStatus:queryError?.response?.status||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
    }
  }, [backendTransactions, activeOrgId, dateRange, creditCardInvoicesTotal, backendSummary]);

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
