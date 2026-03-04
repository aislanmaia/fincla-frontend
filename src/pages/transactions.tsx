import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listTransactions, deleteTransaction, getTransaction, getTransactionsSummary } from '@/api/transactions';
import { Transaction, InstallmentInfo } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Receipt, CreditCard, Calendar, Wallet, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/hooks/useOrganization';
import { useDebounce } from '@/hooks/useDebounce';
import { useDateRange } from '@/hooks/useDateRange';
import { PageTransition } from '@/components/PageTransition';
import { NewTransactionSheet } from '@/components/NewTransactionSheet';
import { DeleteTransactionDialog } from '@/components/DeleteTransactionDialog';
import { handleApiError } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { startOfMonth, endOfMonth, subMonths, format, isSameDay } from 'date-fns';
import { getPresetRange } from '@/hooks/useDateRange';
import { ptBR } from 'date-fns/locale';
import { DateRangePicker } from '@/components/DateRangePicker';
import { CategorySearchPopover } from '@/components/CategorySearchPopover';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

interface TransactionTableRow {
  transactionId: number;
  organizationId: string;
  description: string;
  category: string;
  displayDate: string;
  sortDate: string; // ISO ou YYYY-MM-DD para ordenação
  displayPaymentMethod: string;
  displayValue: number;
  type: 'income' | 'expense';
  transaction: Transaction;
  installment?: InstallmentInfo;
}

function getCategory(tx: Transaction): string {
  if (tx.category) return tx.category;
  const tags = tx.tags as Record<string, { name: string }[]> | undefined;
  return tags?.categoria?.[0]?.name ?? '-';
}

function mapPaymentMethodForDisplay(method: string): string {
  const map: Record<string, string> = {
    pix: 'PIX',
    debit_card: 'Cartão de Débito',
    credit_card: 'Cartão à vista',
    bank_transfer: 'Transferência Bancária',
    money: 'Dinheiro',
    boleto: 'Boleto',
  };
  return map[method?.toLowerCase()] ?? method ?? '';
}

type TransactionWithAmount = Omit<Transaction, 'id' | 'date'> & {
  id?: number | string;
  originalId?: number;
  date?: Date | string;
  amount?: number;
  installment_info?: InstallmentInfo[] | null;
};
function expandTransactionsToRows(transactions: TransactionWithAmount[]): TransactionTableRow[] {
  const rows: TransactionTableRow[] = [];

  for (const tx of transactions) {
    const txId = (tx as { originalId?: number }).originalId ?? (typeof tx.id === 'number' ? tx.id : parseInt(String(tx.id), 10));
    const category = getCategory(tx as Transaction);
    const rawTx = { ...tx, id: txId } as Transaction;

    // À vista: modality === 'cash' ou total_installments === 1 (fallback)
    const modality = tx.credit_card_charge?.charge?.modality ?? (tx as { modality?: string }).modality;
    const instList = tx.installment_info;
    const firstInst = Array.isArray(instList) && instList.length > 0 ? instList[0] : null;
    const isCash = modality === 'cash' || (firstInst?.total_installments === 1);
    const shouldExpand = tx.installment_info?.length && !isCash;

    if (shouldExpand) {
      const instInfo = tx.installment_info ?? [];
      const sorted = [...instInfo].sort((a, b) => a.due_date.localeCompare(b.due_date));
      for (const inst of sorted) {
        const displayValue = tx.type === 'income' ? inst.amount : -inst.amount;
        rows.push({
          transactionId: txId,
          organizationId: tx.organization_id,
          description: tx.description,
          category,
          displayDate: formatDateShort(inst.due_date),
          sortDate: inst.due_date,
          displayPaymentMethod: `Cartão parcelado (${inst.installment_number}/${inst.total_installments})`,
          displayValue,
          type: tx.type,
          transaction: rawTx,
          installment: inst,
        });
      }
    } else {
      const amount = tx.amount ?? (tx.type === 'income' ? tx.value : -tx.value);
      const displayDate = formatDate(tx.date ?? new Date().toISOString());
      const displayPaymentMethod = mapPaymentMethodForDisplay(tx.payment_method || '');
      const cardLast4 = (tx as { card_last4?: string }).card_last4 ?? tx.credit_card_charge?.card?.last4;
      const modality = (tx as { modality?: string }).modality ?? tx.credit_card_charge?.charge?.modality;
      const installmentsCount = (tx as { installments_count?: number }).installments_count ?? tx.credit_card_charge?.charge?.installments_count;
      const isCreditCard = tx.payment_method === 'credit_card' || tx.payment_method === 'Cartão de Crédito';
      const finalPaymentMethod = isCreditCard && cardLast4
        ? (modality === 'installment' && installmentsCount && installmentsCount > 1
          ? `Cartão ${cardLast4} em ${installmentsCount}x`
          : `Cartão ${cardLast4} à vista`)
        : displayPaymentMethod || tx.payment_method || '';

      const dateVal = tx.date as unknown;
      const dateForSort = dateVal instanceof Date ? dateVal.toISOString() : String(tx.date);
      rows.push({
        transactionId: txId,
        organizationId: tx.organization_id,
        description: tx.description,
        category,
        displayDate,
        sortDate: dateForSort,
        displayPaymentMethod: finalPaymentMethod,
        displayValue: amount,
        type: tx.type,
        transaction: rawTx,
      });
    }
  }

  return rows;
}

type SortField = 'description' | 'category' | 'date' | 'value' | 'payment_method';
type SortDirection = 'asc' | 'desc' | null;

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [type, setType] = useState<'todas' | 'receitas' | 'despesas'>('todas');
  const { dateRange, setDateRange } = useDateRange('thisMonth', { storageKey: 'transactions-date-range' });
  const [category, setCategory] = useState<string>('todas');
  const [paymentMethod, setPaymentMethod] = useState<string>('todas');
  const [recurring, setRecurring] = useState<'all' | 'recurring' | 'non_recurring'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMoreFiltersExpanded, setIsMoreFiltersExpanded] = useState(false);

  const ITEMS_PER_PAGE = 20;

  const queryClient = useQueryClient();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();

  // Calcular filtros de data para a API baseado no dateRange selecionado
  const apiDateFilters = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return {};
    }

    return {
      date_start: format(dateRange.from, 'yyyy-MM-dd'),
      date_end: format(dateRange.to, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  // Preparar filtros de tipo para a API
  const apiTypeFilter = useMemo(() => {
    if (type === 'receitas') return { type: 'income' as const };
    if (type === 'despesas') return { type: 'expense' as const };
    return {};
  }, [type]);

  // Função para converter payment method do formato amigável para o formato da API
  const denormalizePaymentMethod = (method: string): string => {
    // Converter valores amigáveis de volta para o formato que a API pode aceitar
    if (method === 'Cartão de Crédito') return 'credit_card';
    if (method === 'Cartão de Débito') return 'debit_card';
    if (method === 'Transferência Bancária') return 'bank_transfer';
    // Para outros métodos (PIX, Dinheiro, Boleto), manter como está
    return method;
  };

  // Preparar filtros de categoria e forma de pagamento para a API
  const apiCategoryFilter = useMemo(() => {
    if (category !== 'todas') return { category };
    return {};
  }, [category]);

  const apiPaymentMethodFilter = useMemo(() => {
    if (paymentMethod !== 'todas') {
      // Converter para o formato que a API aceita
      const apiFormat = denormalizePaymentMethod(paymentMethod);
      return { payment_method: apiFormat };
    }
    return {};
  }, [paymentMethod]);

  // Preparar filtro de busca (description) para a API - usa valor debounced
  const apiDescriptionFilter = useMemo(() => {
    if (debouncedQuery.trim()) return { description: debouncedQuery.trim() };
    return {};
  }, [debouncedQuery]);

  // Preparar filtro de recorrência para a API
  const apiRecurringFilter = useMemo(() => {
    if (recurring === 'all') return {};
    return { recurring: recurring === 'recurring' };
  }, [recurring]);

  // Converter dateRange para string nas queryKeys para evitar recriação de objetos Date
  const dateRangeKey = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}`
    : null;

  // Query para buscar transações paginadas
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions', activeOrgId, dateRangeKey, type, category, paymentMethod, debouncedQuery, recurring, currentPage],
    queryFn: async () => {
      if (!activeOrgId) return null;
      
      return await listTransactions({
        organization_id: activeOrgId,
        ...apiDateFilters,
        ...apiTypeFilter,
        ...apiCategoryFilter,
        ...apiPaymentMethodFilter,
        ...apiDescriptionFilter,
        ...(recurring !== 'all' ? apiRecurringFilter : {}),
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
    },
    enabled: !!activeOrgId,
  });

  // Query para buscar estatísticas (KPIs)
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['transactions-summary', activeOrgId, dateRangeKey, type, category, paymentMethod, debouncedQuery, recurring],
    queryFn: async () => {
      if (!activeOrgId) return null;
      
      return await getTransactionsSummary({
        organization_id: activeOrgId,
        ...apiDateFilters,
        ...apiTypeFilter,
        ...apiCategoryFilter,
        ...apiPaymentMethodFilter,
        ...apiDescriptionFilter,
        ...(recurring !== 'all' ? apiRecurringFilter : {}),
      });
    },
    enabled: !!activeOrgId,
  });

  // Converter Transaction da API para o formato esperado (amount positivo/negativo)
  // Preservar todos os campos originais, incluindo card_last4, modality, installments_count, recurring
  const transactionsWithAmount = useMemo(() => {
    const list = transactionsData?.data || [];
    return list
      .map((t) => ({
        ...t, // Preservar todos os campos originais
        id: t.id.toString(), // Para compatibilidade com a tabela
        originalId: t.id, // Manter id original como number
        amount: t.type === 'income' ? t.value : -t.value,
        date: new Date(t.date),
        createdAt: t.created_at ? new Date(t.created_at) : new Date(t.date), // Fallback para date se created_at não existir
      }));
  }, [transactionsData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (transactionsWithAmount || []).forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [transactionsWithAmount]);

  // Lista completa de métodos de pagamento disponíveis no sistema
  const allAvailablePaymentMethods = [
    'PIX',
    'Dinheiro',
    'Cartão de Débito',
    'Cartão de Crédito',
    'Transferência Bancária',
    'Boleto',
  ];

  // Função para normalizar valores internos para nomes amigáveis
  const normalizePaymentMethod = (method: string): string => {
    if (!method) return '';
    // Mapear valores internos para nomes amigáveis
    if (method === 'credit_card' || method.toLowerCase() === 'credit_card') {
      return 'Cartão de Crédito';
    }
    if (method === 'debit_card' || method.toLowerCase() === 'debit_card') {
      return 'Cartão de Débito';
    }
    if (method === 'bank_transfer' || method.toLowerCase() === 'bank_transfer') {
      return 'Transferência Bancária';
    }
    // Retornar o método original se já estiver no formato correto
    return method;
  };

  // Obter métodos de pagamento únicos das transações (normalizados)
  const paymentMethodsFromTransactions = useMemo(() => {
    const set = new Set<string>();
    (transactionsWithAmount || []).forEach((t) => {
      if (t.payment_method) {
        const normalized = normalizePaymentMethod(t.payment_method);
        if (normalized) set.add(normalized);
      }
    });
    return Array.from(set);
  }, [transactionsWithAmount]);

  // Combinar métodos disponíveis com métodos usados nas transações
  const paymentMethods = useMemo(() => {
    const combined = new Set([...allAvailablePaymentMethods, ...paymentMethodsFromTransactions]);
    return Array.from(combined).sort();
  }, [paymentMethodsFromTransactions]);

  const filtered = useMemo(() => {
    // A API já aplica todos os filtros; aplicar filtro de recorrência no cliente como fallback
    let list = [...transactionsWithAmount];
    if (recurring === 'recurring') {
      list = list.filter((t) => (t as { recurring?: boolean }).recurring === true);
    } else if (recurring === 'non_recurring') {
      list = list.filter((t) => (t as { recurring?: boolean }).recurring !== true);
    }
    return list;
  }, [transactionsWithAmount, recurring]);

  // Expandir transações com installment_info em linhas (uma por parcela)
  const expandedRows = useMemo(() => expandTransactionsToRows(filtered), [filtered]);

  // Ordenar linhas expandidas (a API já ordena transações; parcelas já vêm ordenadas por due_date)
  const sortedRows = useMemo(() => {
    if (!sortField || !sortDirection) return expandedRows;
    return [...expandedRows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'description':
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
          break;
        case 'category':
          aVal = a.category.toLowerCase();
          bVal = b.category.toLowerCase();
          break;
        case 'date':
          aVal = new Date(a.sortDate).getTime();
          bVal = new Date(b.sortDate).getTime();
          break;
        case 'value':
          aVal = Math.abs(a.displayValue);
          bVal = Math.abs(b.displayValue);
          break;
        case 'payment_method':
          aVal = a.displayPaymentMethod.toLowerCase();
          bVal = b.displayPaymentMethod.toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [expandedRows, sortField, sortDirection]);

  // Estatísticas do período filtrado - usar dados do summary da API
  const stats = useMemo(() => {
    if (summaryData) {
      return {
        total: summaryData.total_transactions,
        totalValue: summaryData.total_value,
        income: summaryData.total_income,
        expenses: summaryData.total_expenses,
        balance: summaryData.balance,
      };
    }
    
    // Fallback: calcular das linhas expandidas
    let totalValue = 0;
    let income = 0;
    let expenses = 0;
    sortedRows.forEach((row) => {
      const amount = row.displayValue;
      const absAmount = Math.abs(amount);
      totalValue += absAmount;
      if (amount > 0) income += amount;
      else if (amount < 0) expenses += absAmount;
    });
    return {
      total: sortedRows.length,
      totalValue,
      income,
      expenses,
      balance: income - expenses,
    };
  }, [summaryData, sortedRows]);

  // Paginação - usar dados da API
  const pagination = transactionsData?.pagination;
  const totalPages = pagination?.pages || 1;
  const paginatedTransactions = useMemo(() => sortedRows, [sortedRows]);

  // Resetar página quando busca (debounced) mudar — Input não chama setCurrentPage no onChange
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('date');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
  };

  const downloadCsv = () => {
    const header = ['Descrição', 'Categoria', 'Data', 'Valor', 'Forma de Pagamento'];
    const rows = paginatedTransactions.map((row) => [
      row.description,
      row.category,
      row.displayDate,
      `${row.displayValue < 0 ? '-' : ''}R$ ${formatCurrency(Math.abs(row.displayValue))}`,
      row.displayPaymentMethod,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace('"', '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = async (transaction: Transaction) => {
    try {
      const fullTransaction = await getTransaction(transaction.id, transaction.organization_id);
      
      const transactionWithCardData: Transaction = {
        ...fullTransaction,
        ...(fullTransaction.credit_card_charge ? {} : {
          card_last4: transaction.card_last4 !== undefined ? transaction.card_last4 : (fullTransaction.card_last4 || null),
          modality: transaction.modality !== undefined ? transaction.modality : (fullTransaction.modality !== undefined ? fullTransaction.modality : null),
          installments_count: transaction.installments_count !== undefined ? transaction.installments_count : (fullTransaction.installments_count !== undefined ? fullTransaction.installments_count : null),
        }),
        recurring: transaction.recurring !== undefined ? transaction.recurring : (fullTransaction.recurring !== undefined ? fullTransaction.recurring : false),
      };
      
      setEditingTransaction(transactionWithCardData);
      setIsEditSheetOpen(true);
    } catch (error) {
      const errorMessage = handleApiError(error);
      alert(typeof errorMessage === 'string' ? errorMessage : String(errorMessage));
    }
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;

    try {
      await deleteTransaction(deletingTransaction.id, deletingTransaction.organization_id);
      queryClient.invalidateQueries({ queryKey: ['transactions', activeOrgId] });
      setIsDeleteDialogOpen(false);
      setDeletingTransaction(null);
      
      toast({
        title: "Transação excluída",
        description: "A transação foi excluída com sucesso.",
        variant: "success",
        duration: 5000,
      });
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      toast({
        title: "Erro ao excluir transação",
        description: typeof errorMessage === 'string' ? errorMessage : String(errorMessage),
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleInvalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions', activeOrgId] });
  };

  const handleEditSuccess = () => {
    setIsEditSheetOpen(false);
    setEditingTransaction(null);
  };

  const inputClassName = 'rounded-xl h-10 border-[#D1D5DB] dark:border-gray-600 bg-white dark:bg-gray-900 text-[#111827] dark:text-gray-100 shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1';
  const labelClassName = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400';
  const filterChipClassName = 'gap-1 py-1.5 pl-2.5 pr-1 text-sm font-normal bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700/80';

  const defaultPeriod = getPresetRange('thisMonth');
  const hasActivePeriod = dateRange && (
    !isSameDay(dateRange.from, defaultPeriod.from) || !isSameDay(dateRange.to, defaultPeriod.to)
  );
  const hasActiveSearch = query.trim().length > 0;
  const hasActiveType = type !== 'todas';
  const hasActiveCategory = category !== 'todas';
  const hasActivePayment = paymentMethod !== 'todas';
  const hasActiveRecurring = recurring !== 'all';
  const activeMoreFiltersCount = [hasActiveCategory, hasActivePayment, hasActiveRecurring].filter(Boolean).length;

  // Auto-expand quando o usuário aplica o primeiro filtro secundário
  const prevMoreFiltersCountRef = useRef(0);
  useEffect(() => {
    if (activeMoreFiltersCount > 0 && prevMoreFiltersCountRef.current === 0) {
      setIsMoreFiltersExpanded(true);
    }
    prevMoreFiltersCountRef.current = activeMoreFiltersCount;
  }, [activeMoreFiltersCount]);

  const formatPeriodLabel = () => {
    if (!dateRange?.from || !dateRange?.to) return '';
    if (isSameDay(dateRange.from, dateRange.to)) {
      return format(dateRange.from, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    return `${format(dateRange.from, 'dd/MM/yy', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}`;
  };

  const selectContentInPopoverProps = { side: 'top' as const, className: 'z-[200]' };

  const hasAnyActiveFilter = hasActiveType || hasActivePeriod || hasActiveSearch || hasActiveCategory || hasActivePayment || hasActiveRecurring;

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px] flex flex-col flex-1 min-h-0" style={{ overflow: 'hidden', maxHeight: '100%' }}>
        {/* Toolbar: barra principal */}
        <div className="mt-4 mb-4 flex flex-col gap-3 flex-shrink-0">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label htmlFor="tx-search" className={labelClassName}>Buscar</label>
              <Input
                id="tx-search"
                placeholder="por descrição"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label id="tx-type-label" className={labelClassName}>Tipo</label>
              <Select value={type} onValueChange={(v) => { setType(v as typeof type); setCurrentPage(1); }}>
                <SelectTrigger id="tx-type" aria-labelledby="tx-type-label" className={inputClassName + ' w-full'}>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="receitas">Receitas</SelectItem>
                  <SelectItem value="despesas">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <label id="tx-period-label" className={labelClassName}>Período</label>
              <DateRangePicker
                value={dateRange}
                onChange={(range) => { setDateRange(range); setCurrentPage(1); }}
                className={inputClassName}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMoreFiltersExpanded((v) => !v)}
              className="rounded-xl gap-2 border-[#D1D5DB] dark:border-gray-600 text-[#4A56E2] hover:bg-[#EEF2FF] dark:hover:bg-[#4A56E2]/10 h-10 shrink-0"
            >
              {isMoreFiltersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Mais filtros
              {activeMoreFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 rounded-full text-xs bg-slate-200/80 text-slate-700 hover:bg-slate-300/80 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  {activeMoreFiltersCount}
                </Badge>
              )}
            </Button>
            <Button onClick={downloadCsv} variant="outline" className="rounded-xl gap-2 border-[#D1D5DB] dark:border-gray-600 text-[#4A56E2] hover:bg-[#EEF2FF] dark:hover:bg-[#4A56E2]/10 h-10 shrink-0">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar CSV</span><span className="sm:hidden">Exportar</span>
            </Button>
          </div>

          {isMoreFiltersExpanded && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-0">
                <label id="tx-category-label" className={labelClassName}>Categoria</label>
                <CategorySearchPopover
                  id="tx-category"
                  ariaLabelledBy="tx-category-label"
                  value={category}
                  onValueChange={(v) => { setCategory(v); setCurrentPage(1); }}
                  transactionCategories={categories}
                  triggerClassName={inputClassName}
                  placeholder="Categoria"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label id="tx-payment-label" className={labelClassName}>Forma de Pagamento</label>
                <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setCurrentPage(1); }}>
                  <SelectTrigger id="tx-payment" aria-labelledby="tx-payment-label" className={inputClassName + ' w-full'}>
                    <SelectValue placeholder="Forma de Pagamento" />
                  </SelectTrigger>
                  <SelectContent {...selectContentInPopoverProps}>
                    <SelectItem value="todas">Todas</SelectItem>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0">
                <label id="tx-recurring-label" className={labelClassName}>Recorrência</label>
                <Select value={recurring} onValueChange={(v) => { setRecurring(v as 'all' | 'recurring' | 'non_recurring'); setCurrentPage(1); }}>
                  <SelectTrigger id="tx-recurring" aria-labelledby="tx-recurring-label" className={inputClassName + ' w-full'}>
                    <SelectValue placeholder="Recorrência" />
                  </SelectTrigger>
                  <SelectContent {...selectContentInPopoverProps} side="bottom">
                    <SelectItem value="all">Sem filtro</SelectItem>
                    <SelectItem value="recurring">Somente recorrentes</SelectItem>
                    <SelectItem value="non_recurring">Somente não recorrentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
          <Card className="p-4 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-balance">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 mb-1">Saldo</p>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-24 bg-white/30" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className={`text-2xl font-bold truncate cursor-help ${stats.balance >= 0 ? 'text-white' : 'text-white'}`}>
                          R$ {formatCurrency(stats.balance)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Saldo: R$ {formatCurrency(stats.balance)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="bg-white/20 p-2 rounded-xl ring-1 ring-white/40 flex-shrink-0 ml-2">
                <Wallet className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-income">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 mb-1">Receitas</p>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-24 bg-white/30" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-2xl font-bold text-white truncate cursor-help">R$ {formatCurrency(stats.income)}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Receitas: R$ {formatCurrency(stats.income)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="bg-white/20 p-2 rounded-xl ring-1 ring-white/40 flex-shrink-0 ml-2">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-expense">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 mb-1">Despesas</p>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-24 bg-white/30" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-2xl font-bold text-white truncate cursor-help">R$ {formatCurrency(stats.expenses)}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Despesas: R$ {formatCurrency(stats.expenses)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="bg-white/20 p-2 rounded-xl ring-1 ring-white/40 flex-shrink-0 ml-2">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl shadow-flat shadow-flat-hover border-0 kpi-card kpi-savings">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 mb-1">Total de Transações</p>
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-20 bg-white/30" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-2xl font-bold text-white truncate cursor-help">{stats.total}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Total de Transações: {stats.total}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="bg-white/20 p-2 rounded-xl ring-1 ring-white/40 flex-shrink-0 ml-2">
                <Receipt className="h-6 w-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filtros selecionados - chips abaixo dos KPIs, próximo à tabela */}
        {hasAnyActiveFilter && (
          <div className="mb-4 flex flex-col gap-2 flex-shrink-0">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Filtros selecionados</p>
            <div className="flex flex-wrap gap-2 items-center">
              {hasActiveType && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Tipo: {type === 'receitas' ? 'Receitas' : 'Despesas'}
                  <button type="button" onClick={() => { setType('todas'); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Tipo">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
              {hasActivePeriod && dateRange && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Período: {formatPeriodLabel()}
                  <button type="button" onClick={() => { setDateRange(getPresetRange('thisMonth')); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Período">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
              {hasActiveSearch && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Busca: &quot;{query}&quot;
                  <button type="button" onClick={() => { setQuery(''); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Busca">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
              {hasActiveCategory && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Categoria: {category}
                  <button type="button" onClick={() => { setCategory('todas'); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Categoria">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
              {hasActivePayment && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Forma de Pagamento: {paymentMethod}
                  <button type="button" onClick={() => { setPaymentMethod('todas'); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Forma de Pagamento">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
              {hasActiveRecurring && (
                <Badge variant="secondary" className={filterChipClassName}>
                  Recorrência: {recurring === 'recurring' ? 'Somente recorrentes' : 'Somente não recorrentes'}
                  <button type="button" onClick={() => { setRecurring('all'); setCurrentPage(1); }} className="ml-1 rounded-full p-0.5 hover:bg-muted" aria-label="Remover filtro Recorrência">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}

        <Card className="p-0 rounded-2xl shadow-flat border-0 bg-white flex flex-col flex-1 min-h-0 overflow-hidden" style={{ maxHeight: 'calc(100vh - 450px)' }}>
          <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0" style={{ maxHeight: '100%' }}>
            <Table className="[&>div]:!overflow-visible [&>div]:!h-auto [&>div]:!max-h-none">
              <TableHeader className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]" style={{ position: 'sticky', top: 0, zIndex: 30, backgroundColor: 'white' }}>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[150px] min-w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3 hover:bg-transparent font-medium"
                      onClick={() => handleSort('description')}
                    >
                      Descrição
                      {getSortIcon('description')}
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3 hover:bg-transparent font-medium"
                      onClick={() => handleSort('category')}
                    >
                      Categoria
                      {getSortIcon('category')}
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3 hover:bg-transparent font-medium"
                      onClick={() => handleSort('date')}
                    >
                      Data
                      {getSortIcon('date')}
                    </Button>
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-3 hover:bg-transparent font-medium"
                      onClick={() => handleSort('payment_method')}
                    >
                      Forma de Pagamento
                      {getSortIcon('payment_method')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right min-w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 -mr-3 hover:bg-transparent font-medium"
                      onClick={() => handleSort('value')}
                    >
                      Valor
                      {getSortIcon('value')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoadingTransactions || isLoadingSummary) && (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : undefined}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!isLoadingTransactions && !isLoadingSummary && paginatedTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoadingTransactions && !isLoadingSummary && paginatedTransactions.map((row, idx) => {
                  const isExpense = row.displayValue < 0;
                  const rowKey = row.installment
                    ? `${row.transactionId}-${row.installment.installment_number}`
                    : row.transactionId.toString();

                  const card = row.transaction.credit_card_charge?.card;
                  const paymentMethodCell = row.installment ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted decoration-gray-400">
                            {row.displayPaymentMethod}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] p-0 border-0 shadow-xl rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                          <div className="space-y-0">
                            {card && (
                              <div className="bg-gradient-to-br from-[#4A56E2]/10 to-[#4A56E2]/5 dark:from-[#4A56E2]/20 dark:to-[#4A56E2]/10 px-4 py-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="p-1.5 rounded-lg bg-[#4A56E2]/20 dark:bg-[#4A56E2]/30">
                                    <CreditCard className="h-4 w-4 text-[#4A56E2] dark:text-[#6B7BFF]" />
                                  </div>
                                  <span className="text-xs font-semibold uppercase tracking-wider text-[#4A56E2] dark:text-[#6B7BFF]">Cartão</span>
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                                  {card.brand ? `${card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} ` : ''}****{card.last4}
                                  {card.description && <span className="text-gray-600 dark:text-gray-400 font-normal"> — {card.description}</span>}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5" />
                                  Vencimento da fatura: dia {card.due_day}
                                </p>
                              </div>
                            )}
                            <div className="px-4 py-3 space-y-2">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                                  <Receipt className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Parcela</span>
                              </div>
                              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Compra</span>
                                <span className="font-medium text-right">{formatDateShort(row.transaction.date)}</span>
                                <span className="text-gray-500 dark:text-gray-400">Parcela</span>
                                <span className="font-medium text-right">{row.installment.installment_number} de {row.installment.total_installments}</span>
                                <span className="text-gray-500 dark:text-gray-400">Vencimento</span>
                                <span className="font-medium text-right">{formatDateShort(row.installment.due_date)}</span>
                                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">Valor parcela</span>
                                <span className="font-semibold text-right text-gray-900 dark:text-gray-100">R$ {formatCurrency(row.installment.amount)}</span>
                                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">Valor total</span>
                                <span className="font-semibold text-right text-[#4A56E2] dark:text-[#6B7BFF]">R$ {formatCurrency(row.transaction.value)}</span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    row.displayPaymentMethod
                  );

                  return (
                    <TableRow key={rowKey} className={idx % 2 === 0 ? 'bg-gray-50' : undefined}>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100 max-w-[150px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-help" title={row.description}>
                                {row.description}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="break-words">{row.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-[10px] font-medium px-2 py-0.5 border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300">
                          {row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700">{row.displayDate}</TableCell>
                      <TableCell className="text-gray-700 text-sm">
                        {paymentMethodCell}
                      </TableCell>
                      <TableCell className={isExpense ? 'text-[#F87171] text-right tabular-nums font-semibold' : 'text-[#10B981] text-right tabular-nums font-semibold'}>
                        {isExpense ? '-' : '+'}R$ {formatCurrency(Math.abs(row.displayValue))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(row.transaction)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(row.transaction)}
                            className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação */}
          {!isLoadingTransactions && pagination && totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.has_prev) setCurrentPage(currentPage - 1);
                      }}
                      className={!pagination.has_prev ? 'pointer-events-none opacity-50' : ''}
                    >
                      Anterior
                    </PaginationPrevious>
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={currentPage === page}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.has_next) setCurrentPage(currentPage + 1);
                      }}
                      className={!pagination.has_next ? 'pointer-events-none opacity-50' : ''}
                    >
                      Próxima
                    </PaginationNext>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>

        {/* Sheet de Edição */}
        <NewTransactionSheet
          open={isEditSheetOpen}
          onOpenChange={setIsEditSheetOpen}
          onSuccess={handleEditSuccess}
          onInvalidateCache={handleInvalidateCache}
          transactionToEdit={editingTransaction}
        />

        {/* Diálogo de Confirmação de Exclusão */}
        <DeleteTransactionDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          transaction={deletingTransaction}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </PageTransition>
  );
}
