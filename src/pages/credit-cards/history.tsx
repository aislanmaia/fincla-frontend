import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/PageTransition';
import { Breadcrumb } from '@/components/Breadcrumb';
import { listCreditCards, getCreditCardInvoice } from '@/api/creditCards';
import { CreditCard, InvoiceResponse } from '@/types/api';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard as CreditCardIcon, Download, Eye, Search, Filter } from 'lucide-react';
import { format, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InvoiceHistoryItem {
  year: number;
  month: number;
  total: number;
  status: 'paid' | 'overdue' | 'pending';
  dueDate: string;
}

export default function InvoiceHistoryPage() {
    const [, setLocation] = useLocation();
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [selectedSemester, setSelectedSemester] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Generate year options (last 5 years)
    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const year = new Date().getFullYear() - i;
        return { value: String(year), label: String(year) };
    });

    const semesterOptions = [
        { value: 'all', label: 'Ano Completo' },
        { value: '1', label: '1º Semestre (Jan-Jun)' },
        { value: '2', label: '2º Semestre (Jul-Dez)' },
    ];

    // Load Cards
    useEffect(() => {
        const loadCards = async () => {
            if (!currentOrg?.id) return;
            try {
                const data = await listCreditCards(currentOrg.id);
                setCards(data);
                if (data.length > 0) {
                    setSelectedCardId(String(data[0].id));
                }
            } catch (error) {
                console.error('Failed to load cards:', error);
                toast.error('Erro ao carregar cartões');
            }
        };
        loadCards();
    }, [currentOrg?.id]);

    // Load Invoice History
    useEffect(() => {
        const loadInvoiceHistory = async () => {
            if (!selectedCardId || !currentOrg?.id) return;

            try {
                setIsLoading(true);
                const year = Number(selectedYear);
                
                // Determine month range based on semester
                let startMonth = 1;
                let endMonth = 12;
                
                if (selectedSemester === '1') {
                    startMonth = 1;
                    endMonth = 6;
                } else if (selectedSemester === '2') {
                    startMonth = 7;
                    endMonth = 12;
                }

                // Load all invoices for the period
                const invoices: InvoiceHistoryItem[] = [];
                
                for (let month = startMonth; month <= endMonth; month++) {
                    try {
                        const invoice = await getCreditCardInvoice(
                            Number(selectedCardId),
                            year,
                            month,
                            currentOrg.id
                        );
                        
                        // If we get here, invoice exists (200 response means invoice exists with items)
                        // Determine status based on due date
                        const dueDate = new Date(invoice.due_date);
                        const now = new Date();
                        let status: 'paid' | 'overdue' | 'pending' = 'pending';
                        
                        if (dueDate < now) {
                            status = 'overdue'; // Could be refined with payment info
                        }
                        
                        invoices.push({
                            year,
                            month,
                            total: invoice.total_amount,
                            status,
                            dueDate: invoice.due_date,
                        });
                    } catch (err: any) {
                        // 404 means invoice doesn't exist for this month/card - skip
                        if (err?.response?.status === 404) {
                            continue;
                        }
                        // Other errors - log but continue
                        console.error(`Erro ao carregar fatura ${year}/${month}:`, err);
                        continue;
                    }
                }
                
                // Sort by date (most recent first)
                invoices.sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                });
                
                setInvoiceHistory(invoices);
            } catch (error) {
                console.error('Failed to load invoice history:', error);
                toast.error('Erro ao carregar histórico de faturas');
            } finally {
                setIsLoading(false);
            }
        };

        loadInvoiceHistory();
    }, [selectedCardId, selectedYear, selectedSemester, currentOrg?.id]);

    // Filter invoices based on search
    const filteredInvoices = invoiceHistory.filter((invoice) => {
        if (!searchQuery) return true;
        
        const monthName = format(new Date(invoice.year, invoice.month - 1), 'MMMM yyyy', { locale: ptBR });
        const total = `R$ ${invoice.total.toFixed(2)}`;
        const status = getStatusLabel(invoice.status);
        
        return (
            monthName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            total.includes(searchQuery) ||
            status.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid': return 'Paga';
            case 'overdue': return 'Vencida';
            case 'pending': return 'Pendente';
            default: return status;
        }
    };

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'default';
            case 'overdue': return 'destructive';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };

    const getStatusBadgeClasses = (status: string) => {
        switch (status) {
            case 'paid': 
                return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800';
            case 'overdue': 
                return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800';
            case 'pending': 
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            default: 
                return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        }
    };

    const handleViewDetails = (year: number, month: number) => {
        if (!selectedCardId) {
            toast.error('Selecione um cartão primeiro');
            return;
        }
        
        // Navigate to credit cards page with query parameters
        setLocation(`/credit-cards?cardId=${selectedCardId}&year=${year}&month=${month}`);
    };

    const handleDownloadPDF = async (year: number, month: number) => {
        // TODO: Implementar quando o endpoint de PDF estiver disponível
        const monthName = format(new Date(year, month - 1), 'MMMM yyyy', { locale: ptBR });
        toast.info(`Download de PDF para ${monthName} será implementado em breve.`);
        
        // Exemplo de implementação futura:
        // try {
        //     const response = await apiClient.get(`/credit-cards/${selectedCardId}/invoices/${year}/${month}/pdf`, {
        //         params: { organization_id: currentOrg?.id },
        //         responseType: 'blob'
        //     });
        //     const url = window.URL.createObjectURL(new Blob([response.data]));
        //     const link = document.createElement('a');
        //     link.href = url;
        //     link.setAttribute('download', `fatura-${monthName}.pdf`);
        //     document.body.appendChild(link);
        //     link.click();
        //     link.remove();
        // } catch (error) {
        //     toast.error('Erro ao baixar PDF');
        // }
    };

    return (
        <PageTransition>
            <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-4 sm:space-y-6">
                {/* Breadcrumb */}
                <Breadcrumb
                    items={[
                        { label: 'Cartões', href: '/credit-cards', icon: <CreditCardIcon className="w-4 h-4" /> },
                        { label: 'Histórico de Faturas' },
                    ]}
                />

                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Histórico de Faturas</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">Consulte e analise todas as suas faturas anteriores</p>
                </div>

                {/* Filters Toolbar */}
                <Card className="p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Ferramentas de Análise</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {/* Card Selector */}
                            <div>
                                <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Cartão</label>
                                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                    <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Selecione um cartão" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cards.map((card) => (
                                            <SelectItem key={card.id} value={String(card.id)} className="text-sm">
                                                {card.description || `Cartão final ${card.last4}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Year Filter */}
                            <div>
                                <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Ano</label>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Selecione o ano" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {yearOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="text-sm">
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Semester Filter */}
                            <div>
                                <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Semestre</label>
                                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                                    <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Selecione o semestre" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {semesterOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="text-sm">
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Global Search */}
                            <div>
                                <label className="text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 block">Busca Global</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Pesquisar faturas..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-8 sm:pl-9 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Summary Stats */}
                {!isLoading && filteredInvoices.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <Card className="p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total de Faturas</div>
                            <div className="text-xl sm:text-2xl font-bold">{filteredInvoices.length}</div>
                        </Card>
                        <Card className="p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Valor Total do Período</div>
                            <div className="text-xl sm:text-2xl font-bold">
                                R$ {filteredInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
                            </div>
                        </Card>
                        <Card className="p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-muted-foreground mb-1">Média Mensal</div>
                            <div className="text-xl sm:text-2xl font-bold">
                                R$ {(filteredInvoices.reduce((sum, inv) => sum + inv.total, 0) / filteredInvoices.length).toFixed(2)}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Invoices Table */}
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs sm:text-sm">Mês/Ano</TableHead>
                                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                                    <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Vencimento</TableHead>
                                    <TableHead className="text-right text-xs sm:text-sm">Valor Total</TableHead>
                                    <TableHead className="text-right text-xs sm:text-sm">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">
                                            Carregando faturas...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-6 sm:py-8 text-xs sm:text-sm text-muted-foreground">
                                            {searchQuery ? 'Nenhuma fatura encontrada para esta busca.' : 'Nenhuma fatura encontrada para o período selecionado.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInvoices.map((invoice) => {
                                        const monthLabel = format(new Date(invoice.year, invoice.month - 1), 'MMMM yyyy', { locale: ptBR });
                                        const dueDateLabel = format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: ptBR });
                                        
                                        return (
                                            <TableRow key={`${invoice.year}-${invoice.month}`}>
                                                <TableCell className="font-medium capitalize text-xs sm:text-sm">{monthLabel}</TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        variant="outline" 
                                                        className={cn(
                                                            "text-[10px] sm:text-xs font-semibold",
                                                            getStatusBadgeClasses(invoice.status)
                                                        )}
                                                    >
                                                        {getStatusLabel(invoice.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{dueDateLabel}</TableCell>
                                                <TableCell className="text-right font-medium text-xs sm:text-sm whitespace-nowrap">
                                                    R$ {invoice.total.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDownloadPDF(invoice.year, invoice.month)}
                                                            className="text-xs p-1.5 sm:p-2"
                                                        >
                                                            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                                                            <span className="hidden md:inline">Baixar PDF</span>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewDetails(invoice.year, invoice.month)}
                                                            className="text-xs p-1.5 sm:p-2"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                                                            <span className="hidden md:inline">Ver Detalhes</span>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </PageTransition>
    );
}
