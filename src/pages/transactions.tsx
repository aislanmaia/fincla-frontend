import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listTransactions, deleteTransaction, getTransaction } from '@/api/transactions';
import { Transaction } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { PageTransition } from '@/components/PageTransition';
import { NewTransactionSheet } from '@/components/NewTransactionSheet';
import { DeleteTransactionDialog } from '@/components/DeleteTransactionDialog';
import { handleApiError } from '@/api/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

type SortField = 'description' | 'category' | 'date' | 'value' | 'payment_method';
type SortDirection = 'asc' | 'desc' | null;

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'todas' | 'receitas' | 'despesas'>('todas');
  const [period, setPeriod] = useState<'tudo' | '7d' | '30d' | '90d' | 'este-mes' | 'mes-anterior'>('tudo');
  const [category, setCategory] = useState<string>('todas');
  const [paymentMethod, setPaymentMethod] = useState<string>('todas');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const ITEMS_PER_PAGE = 20;

  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { activeOrgId } = useOrganization();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      return await listTransactions({ organization_id: activeOrgId });
    },
    enabled: !!activeOrgId,
  });

  // Converter Transaction da API para o formato esperado (amount positivo/negativo)
  // Preservar todos os campos originais, incluindo card_last4, modality, installments_count, recurring
  const transactionsWithAmount = useMemo(() => {
    const list = Array.isArray(data) ? [...data] : [];
    return list
      .map((t) => ({
        ...t, // Preservar todos os campos originais
        id: t.id.toString(), // Para compatibilidade com a tabela
        originalId: t.id, // Manter id original como number
        amount: t.type === 'income' ? t.value : -t.value,
        date: new Date(t.date),
        createdAt: t.created_at ? new Date(t.created_at) : new Date(t.date), // Fallback para date se created_at não existir
      }));
  }, [data]);

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
    let list = [...transactionsWithAmount];
    
    // Tipo
    if (type === 'receitas') list = list.filter((t) => t.amount > 0);
    if (type === 'despesas') list = list.filter((t) => t.amount < 0);
    
    // Período
    if (period !== 'tudo') {
      const now = new Date();
      let cutoff: Date;
      
      if (period === '7d') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter((t) => new Date(t.date).getTime() >= cutoff.getTime());
      } else if (period === '30d') {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        list = list.filter((t) => new Date(t.date).getTime() >= cutoff.getTime());
      } else if (period === '90d') {
        cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        list = list.filter((t) => new Date(t.date).getTime() >= cutoff.getTime());
      } else if (period === 'este-mes') {
        cutoff = startOfMonth(now);
        const end = endOfMonth(now);
        list = list.filter((t) => {
          const tDate = new Date(t.date);
          return tDate >= cutoff && tDate <= end;
        });
      } else if (period === 'mes-anterior') {
        const lastMonth = subMonths(now, 1);
        cutoff = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        list = list.filter((t) => {
          const tDate = new Date(t.date);
          return tDate >= cutoff && tDate <= end;
        });
      }
    }
    
    // Categoria
    if (category !== 'todas') list = list.filter((t) => t.category === category);
    
    // Forma de pagamento (normalizar antes de comparar)
    if (paymentMethod !== 'todas') {
      list = list.filter((t) => {
        const normalized = normalizePaymentMethod(t.payment_method || '');
        return normalized === paymentMethod;
      });
    }
    
    // Busca
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    
    // Ordenamento
    if (sortField && sortDirection) {
      list.sort((a, b) => {
        let aVal: any;
        let bVal: any;
        
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
            aVal = a.date.getTime();
            bVal = b.date.getTime();
            break;
          case 'value':
            aVal = Math.abs(a.amount);
            bVal = Math.abs(b.amount);
            break;
          case 'payment_method':
            aVal = (a.payment_method || '').toLowerCase();
            bVal = (b.payment_method || '').toLowerCase();
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return list;
  }, [transactionsWithAmount, type, period, category, paymentMethod, query, sortField, sortDirection]);

  // Estatísticas do período filtrado
  const stats = useMemo(() => {
    const total = filtered.length;
    
    let totalValue = 0;
    let income = 0;
    let expenses = 0;
    
    filtered.forEach((t) => {
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
      const absAmount = Math.abs(amount);
      
      totalValue += absAmount;
      
      if (amount > 0) {
        income += amount;
      } else if (amount < 0) {
        expenses += absAmount;
      }
    });
    
    const balance = income - expenses;
    
    return { total, totalValue, income, expenses, balance };
  }, [filtered]);

  // Paginação
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filtered.slice(start, end);
  }, [filtered, currentPage]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [type, period, category, paymentMethod, query, sortField, sortDirection]);

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

  const formatPaymentMethod = (transaction: any) => {
    const method = transaction.payment_method || '';
    const isCreditCard = method === 'Cartão de Crédito' || method === 'credit_card';
    
    if (!isCreditCard) {
      return method;
    }
    
    const cardLast4 = transaction.card_last4 || transaction.credit_card_charge?.card?.last4 || '';
    const modality = transaction.modality || transaction.credit_card_charge?.charge?.modality;
    const installmentsCount = transaction.installments_count || transaction.credit_card_charge?.charge?.installments_count;
    
    if (modality === 'installment' && installmentsCount && installmentsCount > 1) {
      return `Cartão ${cardLast4} em ${installmentsCount}x`;
    }
    
    return `Cartão ${cardLast4} à vista`;
  };

  const getInstallmentInfo = (transaction: any) => {
    const modality = transaction.modality || transaction.credit_card_charge?.charge?.modality;
    const installmentsCount = transaction.installments_count || transaction.credit_card_charge?.charge?.installments_count;
    const totalAmount = transaction.credit_card_charge?.charge?.total_amount || transaction.value || Math.abs(transaction.amount);
    
    if (modality === 'installment' && installmentsCount && installmentsCount > 1) {
      const installmentValue = totalAmount / installmentsCount;
      return `${installmentsCount}x de ${formatCurrency(installmentValue)}`;
    }
    
    return null;
  };

  const downloadCsv = () => {
    const header = ['Descrição', 'Categoria', 'Data', 'Valor', 'Forma de Pagamento'];
    const rows = filtered.map((t) => [
      t.description,
      t.category,
      formatDate(t.date as any),
      `${t.amount < 0 ? '-' : ''}R$ ${formatCurrency(Math.abs(t.amount))}`,
      formatPaymentMethod(t),
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

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px] flex flex-col flex-1 min-h-0" style={{ overflow: 'hidden', maxHeight: '100%' }}>
        <div className="mt-4 mb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="inline-flex items-center text-sm text-[#4A56E2] hover:text-[#343D9B]">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </a>
            </Link>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Todas as Transações</h1>
          </div>
        </div>

        {/* Toolbar: filtros à esquerda, ações à direita */}
        <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3 flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
            <div className="md:col-span-2">
              <label htmlFor="tx-search" className="mb-1 block text-xs font-medium text-gray-600">Buscar</label>
              <Input
                id="tx-search"
                placeholder="por descrição ou categoria"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="rounded-xl h-10 border-[#D1D5DB] bg-white placeholder-[#9CA3AF] shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1"
              />
            </div>
            <div>
              <label id="tx-type-label" className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger id="tx-type" aria-labelledby="tx-type-label" className="rounded-xl h-10 border-[#D1D5DB] bg-white text-[#111827] shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="receitas">Receitas</SelectItem>
                  <SelectItem value="despesas">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label id="tx-period-label" className="mb-1 block text-xs font-medium text-gray-600">Período</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger id="tx-period" aria-labelledby="tx-period-label" className="rounded-xl h-10 border-[#D1D5DB] bg-white text-[#111827] shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tudo">Tudo</SelectItem>
                  <SelectItem value="este-mes">Este mês</SelectItem>
                  <SelectItem value="mes-anterior">Mês anterior</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label id="tx-category-label" className="mb-1 block text-xs font-medium text-gray-600">Categoria</label>
              <Select value={category} onValueChange={(v) => setCategory(v)}>
                <SelectTrigger id="tx-category" aria-labelledby="tx-category-label" className="rounded-xl h-10 border-[#D1D5DB] bg-white text-[#111827] shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label id="tx-payment-label" className="mb-1 block text-xs font-medium text-gray-600">Forma de Pagamento</label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
                <SelectTrigger id="tx-payment" aria-labelledby="tx-payment-label" className="rounded-xl h-10 border-[#D1D5DB] bg-white text-[#111827] shadow-sm focus-visible:ring-2 focus-visible:ring-[#4A56E2] focus-visible:ring-offset-1">
                  <SelectValue placeholder="Forma de Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex md:justify-end">
            <Button onClick={downloadCsv} variant="outline" className="rounded-xl gap-2 border-[#D1D5DB] text-[#4A56E2] hover:bg-[#EEF2FF]">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
          <Card className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 mb-1">Total de Transações</p>
                <p className="text-2xl font-bold text-gray-900 truncate">{stats.total}</p>
              </div>
              <Receipt className="h-8 w-8 text-gray-400 flex-shrink-0 ml-2" />
            </div>
          </Card>
          <Card className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 mb-1">Valor Total</p>
                <p className="text-2xl font-bold text-gray-900 truncate">R$ {formatCurrency(stats.totalValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 flex-shrink-0 ml-2" />
            </div>
          </Card>
          <Card className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 mb-1">Receitas</p>
                <p className="text-2xl font-bold text-green-600 truncate">R$ {formatCurrency(stats.income)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 flex-shrink-0 ml-2" />
            </div>
          </Card>
          <Card className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600 mb-1">Despesas</p>
                <p className="text-2xl font-bold text-red-600 truncate">R$ {formatCurrency(stats.expenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 flex-shrink-0 ml-2" />
            </div>
          </Card>
        </div>

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
                {isLoading && (
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

                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && paginatedTransactions.map((t, idx) => {
                  const isExpense = t.amount < 0;
                  const transaction: Transaction = {
                    id: (t as any).originalId || parseInt(t.id),
                    organization_id: t.organization_id,
                    type: isExpense ? 'expense' : 'income',
                    description: t.description,
                    category: t.category,
                    value: Math.abs(t.amount),
                    payment_method: t.payment_method || '',
                    date: t.date instanceof Date ? t.date.toISOString() : t.date,
                    tags: t.tags || [],
                    card_last4: (t as any).card_last4 !== undefined ? (t as any).card_last4 : undefined,
                    modality: (t as any).modality !== undefined ? (t as any).modality : undefined,
                    installments_count: (t as any).installments_count !== undefined ? (t as any).installments_count : undefined,
                    recurring: (t as any).recurring !== undefined ? (t as any).recurring : undefined,
                    credit_card_charge: (t as any).credit_card_charge,
                  };
                  
                  const installmentInfo = getInstallmentInfo(t);
                  
                  return (
                    <TableRow key={t.id} className={idx % 2 === 0 ? 'bg-gray-50' : undefined}>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100 max-w-[150px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-help" title={t.description}>
                                {t.description}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="break-words">{t.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-[10px] font-medium px-2 py-0.5 border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300">
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700">{formatDate(t.date as any)}</TableCell>
                      <TableCell className="text-gray-700 text-sm">
                        {formatPaymentMethod(t)}
                      </TableCell>
                      <TableCell className={isExpense ? 'text-[#F87171] text-right tabular-nums font-semibold' : 'text-[#10B981] text-right tabular-nums font-semibold'}>
                        <div className="flex flex-col items-end">
                          <span>{isExpense ? '-' : '+'}R$ {formatCurrency(Math.abs(t.amount))}</span>
                          {installmentInfo && (
                            <span className="text-xs text-gray-500 font-normal mt-0.5">{installmentInfo}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(transaction)}
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
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
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
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
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
