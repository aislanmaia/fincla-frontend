import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listTransactions, deleteTransaction, getTransaction } from '@/api/transactions';
import { Transaction } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, Edit, Trash2 } from 'lucide-react';
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

export default function TransactionsPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'todas' | 'receitas' | 'despesas'>('todas');
  const [period, setPeriod] = useState<'tudo' | '7d' | '30d' | '90d'>('tudo');
  const [category, setCategory] = useState<string>('todas');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Ordenar por data de criação (mais recente primeiro)
  }, [data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (transactionsWithAmount || []).forEach((t) => set.add(t.category));
    return Array.from(set).sort();
  }, [transactionsWithAmount]);

  const filtered = useMemo(() => {
    let list = [...transactionsWithAmount];
    // Tipo
    if (type === 'receitas') list = list.filter((t) => t.amount > 0);
    if (type === 'despesas') list = list.filter((t) => t.amount < 0);
    // Período
    if (period !== 'tudo') {
      const now = new Date().getTime();
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter((t) => new Date(t.date).getTime() >= cutoff);
    }
    // Categoria
    if (category !== 'todas') list = list.filter((t) => t.category === category);
    // Busca
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactionsWithAmount, type, period, category, query]);

  const downloadCsv = () => {
    const header = ['Descrição', 'Categoria', 'Data', 'Valor'];
    const rows = filtered.map((t) => [
      t.description,
      t.category,
      formatDate(t.date as any),
      `${t.amount < 0 ? '-' : ''}R$ ${formatCurrency(Math.abs(t.amount))}`,
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
      // Buscar dados completos da transação do backend
      // O GET agora retorna credit_card_charge com todos os dados do cartão
      const fullTransaction = await getTransaction(transaction.id, transaction.organization_id);
      
      // Se o GET não retornar credit_card_charge mas a lista tiver campos legados, preservar
      // (compatibilidade com versões antigas ou casos edge)
      const transactionWithCardData: Transaction = {
        ...fullTransaction,
        // Preservar campos legados apenas se credit_card_charge não estiver presente
        // e os campos legados estiverem disponíveis na lista original
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
      
      // Feedback de sucesso
      toast({
        title: "Transação excluída",
        description: "A transação foi excluída com sucesso.",
        variant: "success",
        duration: 5000,
      });
    } catch (error) {
      const errorMessage = handleApiError(error);
      
      // Feedback de erro
      toast({
        title: "Erro ao excluir transação",
        description: typeof errorMessage === 'string' ? errorMessage : String(errorMessage),
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleInvalidateCache = () => {
    // Invalidar cache imediatamente após sucesso para atualizar a lista
    queryClient.invalidateQueries({ queryKey: ['transactions', activeOrgId] });
  };

  const handleEditSuccess = () => {
    // Fechar painel e limpar estado quando o usuário fechar após ver a mensagem de sucesso
    setIsEditSheetOpen(false);
    setEditingTransaction(null);
  };

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px]">
        <div className="mt-4 mb-4 flex items-center justify-between">
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
        <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 flex-1">
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
          </div>
          <div className="flex md:justify-end">
            <Button onClick={downloadCsv} variant="outline" className="rounded-xl gap-2 border-[#D1D5DB] text-[#4A56E2] hover:bg-[#EEF2FF]">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        <Card className="p-0 rounded-2xl shadow-flat border-0 bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
                <TableRow className="bg-gray-50">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <TableRow key={`sk-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : undefined}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-28 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}

                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && filtered.map((t, idx) => {
                  const isExpense = t.amount < 0;
                  // Converter para formato Transaction da API usando dados originais
                  // Preservar todos os campos, incluindo card_last4, modality, installments_count, recurring
                  // IMPORTANTE: A lista de transações pode não retornar esses campos, mas tentamos preservá-los
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
                    // Preservar campos do cartão de crédito se existirem na lista
                    // Se não existirem, serão undefined e tentaremos buscar do GET
                    card_last4: (t as any).card_last4 !== undefined ? (t as any).card_last4 : undefined,
                    modality: (t as any).modality !== undefined ? (t as any).modality : undefined,
                    installments_count: (t as any).installments_count !== undefined ? (t as any).installments_count : undefined,
                    recurring: (t as any).recurring !== undefined ? (t as any).recurring : undefined,
                  };
                  return (
                    <TableRow key={t.id} className={idx % 2 === 0 ? 'bg-gray-50' : undefined}>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-100">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-[10px] font-medium px-2 py-0.5 border-gray-200 text-gray-600 dark:border-white/15 dark:text-gray-300">
                          {t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-700">{formatDate(t.date as any)}</TableCell>
                      <TableCell className={isExpense ? 'text-[#F87171] text-right tabular-nums font-semibold' : 'text-[#10B981] text-right tabular-nums font-semibold'}>
                        {isExpense ? '-' : '+'}R$ {formatCurrency(Math.abs(t.amount))}
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


