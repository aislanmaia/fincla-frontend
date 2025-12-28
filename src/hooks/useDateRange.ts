import { useState, useCallback, useEffect } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { Transaction } from '@/types/api';

export interface DateRange {
  from: Date;
  to: Date;
}

export type PeriodPreset = 
  | 'today' 
  | 'yesterday' 
  | 'thisWeek' 
  | 'lastWeek' 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'thisYear'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'custom';

/**
 * Calcula o range de datas para um preset específico
 */
export function getPresetRange(preset: PeriodPreset): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  
  switch (preset) {
    case 'today':
      return { from: today, to: endOfDay(now) };
    
    case 'yesterday': {
      const yesterday = startOfDay(subDays(now, 1));
      return { from: yesterday, to: endOfDay(yesterday) };
    }
    
    case 'thisWeek': {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Segunda-feira
      return { from: startOfDay(weekStart), to: endOfDay(now) };
    }
    
    case 'lastWeek': {
      const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      return { from: startOfDay(lastWeekStart), to: endOfDay(lastWeekEnd) };
    }
    
    case 'thisMonth': {
      const monthStart = startOfMonth(now);
      return { from: monthStart, to: endOfDay(now) };
    }
    
    case 'lastMonth': {
      const lastMonth = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      return { from: startOfDay(lastMonthStart), to: endOfDay(lastMonthEnd) };
    }
    
    case 'thisYear': {
      const yearStart = startOfYear(now);
      return { from: yearStart, to: endOfDay(now) };
    }
    
    case 'last7Days': {
      const from = subDays(now, 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    
    case 'last30Days': {
      const from = subDays(now, 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    
    case 'last90Days': {
      const from = subDays(now, 89);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    
    default:
      return { from: startOfMonth(now), to: endOfDay(now) };
  }
}

/**
 * Filtra transações por range de datas
 */
export function filterTransactionsByDateRange(
  transactions: Transaction[],
  dateRange?: DateRange
): Transaction[] {
  if (!dateRange) return transactions;
  
  return transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    return (
      transactionDate >= dateRange.from &&
      transactionDate <= dateRange.to
    );
  });
}

/**
 * Hook para gerenciar seleção de período
 */
export function useDateRange(defaultPreset: PeriodPreset = 'thisMonth') {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    // Inicializar com preset padrão
    return getPresetRange(defaultPreset);
  });

  const setPreset = useCallback((preset: PeriodPreset) => {
    setDateRange(getPresetRange(preset));
  }, []);

  const setCustomRange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
  }, []);

  // Persistir no localStorage
  useEffect(() => {
    if (dateRange) {
      try {
        localStorage.setItem('dashboard-date-range', JSON.stringify({
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        }));
      } catch (error) {
        console.error('Erro ao salvar date range no localStorage:', error);
      }
    }
  }, [dateRange]);

  // Carregar do localStorage na inicialização
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard-date-range');
      if (saved) {
        const parsed = JSON.parse(saved);
        setDateRange({
          from: new Date(parsed.from),
          to: new Date(parsed.to),
        });
      }
    } catch (error) {
      console.error('Erro ao carregar date range do localStorage:', error);
    }
  }, []);

  return {
    dateRange,
    setDateRange: setCustomRange,
    setPreset,
    clearRange: () => setDateRange(undefined),
  };
}

