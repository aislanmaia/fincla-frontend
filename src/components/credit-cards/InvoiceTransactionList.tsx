import React, { useState, useMemo } from 'react';
import { InvoiceItemResponse } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Tag as TagIcon, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface InvoiceTransactionListProps {
    transactions: InvoiceItemResponse[];
    isLoading: boolean;
    grouped?: boolean;
    compactCards?: boolean;
    mobileOptimized?: boolean;
    stickyHeader?: boolean;
    maxHeight?: string;
}

interface TransactionGroup {
    date: string;
    dateLabel: string;
    transactions: InvoiceItemResponse[];
    total: number;
}

export const InvoiceTransactionList: React.FC<InvoiceTransactionListProps> = ({
    transactions,
    isLoading,
    grouped = false,
    compactCards = false,
    mobileOptimized = false,
    stickyHeader = false,
    maxHeight,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const filteredTransactions = useMemo(() => {
        return transactions
            .filter((t) =>
                t.description.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                if (sortBy === 'date') {
                    return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
                } else {
                    return b.amount - a.amount;
                }
            });
    }, [transactions, searchTerm, sortBy]);

    // Agrupar por data
    const groupedTransactions = useMemo((): TransactionGroup[] => {
        if (!grouped) return [];

        const groups = new Map<string, InvoiceItemResponse[]>();
        
        filteredTransactions.forEach((t) => {
            const dateKey = t.transaction_date.split('T')[0];
            if (!groups.has(dateKey)) {
                groups.set(dateKey, []);
            }
            groups.get(dateKey)!.push(t);
        });

        return Array.from(groups.entries())
            .map(([date, items]) => {
                const parsedDate = parseISO(date);
                let dateLabel: string;
                
                if (isToday(parsedDate)) {
                    dateLabel = 'Hoje';
                } else if (isYesterday(parsedDate)) {
                    dateLabel = 'Ontem';
                } else {
                    dateLabel = format(parsedDate, "dd 'de' MMMM", { locale: ptBR });
                }

                return {
                    date,
                    dateLabel,
                    transactions: items,
                    total: items.reduce((sum, t) => sum + t.amount, 0),
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredTransactions, grouped]);

    // Inicializar grupos expandidos (2 primeiros abertos)
    React.useEffect(() => {
        if (grouped && groupedTransactions.length > 0) {
            const initialExpanded = new Set(
                groupedTransactions.slice(0, 2).map(g => g.date)
            );
            setExpandedGroups(initialExpanded);
        }
    }, [grouped, groupedTransactions.length]);

    const toggleGroup = (date: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    const allExpanded = grouped && groupedTransactions.length > 0 && 
        groupedTransactions.every(g => expandedGroups.has(g.date));

    const toggleAllGroups = () => {
        if (allExpanded) {
            // Colapsar todos
            setExpandedGroups(new Set());
        } else {
            // Expandir todos
            setExpandedGroups(new Set(groupedTransactions.map(g => g.date)));
        }
    };

    const renderTransaction = (transaction: InvoiceItemResponse) => (
        <Card 
            key={transaction.id} 
            className={cn(
                "flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                compactCards || mobileOptimized ? "p-3" : "p-4"
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                {/* Date badge - hidden when grouped */}
                {!grouped && (
                    <div className={cn(
                        "flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0",
                        compactCards ? "w-10 h-10" : "w-12 h-12"
                    )}>
                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                            {format(new Date(transaction.transaction_date), 'MMM', { locale: ptBR })}
                        </span>
                        <span className={cn("font-bold", compactCards ? "text-base" : "text-lg")}>
                            {format(new Date(transaction.transaction_date), 'dd')}
                        </span>
                    </div>
                )}

                <div className="min-w-0">
                    <div className={cn(
                        "font-medium truncate",
                        compactCards && "text-sm"
                    )}>
                        {transaction.description}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        {transaction.total_installments > 1 && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-medium">
                                {transaction.installment_number}/{transaction.total_installments}
                            </span>
                        )}

                        {/* Category Tag */}
                        {transaction.tags?.['categoria']?.[0] ? (
                            <span
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs whitespace-nowrap"
                                style={{
                                    backgroundColor: `${transaction.tags['categoria'][0].color}20`,
                                    color: transaction.tags['categoria'][0].color || 'currentColor'
                                }}
                            >
                                {transaction.tags['categoria'][0].name}
                            </span>
                        ) : !mobileOptimized && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-500 hover:text-orange-600 hover:bg-orange-50">
                                <TagIcon className="w-3 h-3 mr-1" />
                                Classificar
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className={cn(
                "font-bold text-right flex-shrink-0",
                compactCards && "text-sm"
            )}>
                {formatCurrency(transaction.amount)}
            </div>
        </Card>
    );

    const renderGroupedList = () => (
        <div className="space-y-3">
            {groupedTransactions.map((group) => {
                const isExpanded = expandedGroups.has(group.date);
                
                return (
                    <Collapsible
                        key={group.date}
                        open={isExpanded}
                        onOpenChange={() => toggleGroup(group.date)}
                    >
                        <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium">{group.dateLabel}</span>
                                    <span className="text-sm text-muted-foreground">
                                        ({group.transactions.length} {group.transactions.length === 1 ? 'transação' : 'transações'})
                                    </span>
                                </div>
                                <span className="font-semibold text-sm">
                                    {formatCurrency(group.total)}
                                </span>
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-2 space-y-2 pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                                {group.transactions.map(renderTransaction)}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}
        </div>
    );

    const renderFlatList = () => (
        <div className="space-y-2">
            {filteredTransactions.map(renderTransaction)}
        </div>
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div 
            className={cn(
                "flex flex-col",
                maxHeight && "h-full"
            )}
            style={maxHeight ? { maxHeight } : undefined}
        >
            {/* Header */}
            <div className={cn(
                "flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-4",
                stickyHeader && "sticky top-0 bg-background z-10 pb-3"
            )}>
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Transações</h3>
                    {transactions.length > 0 && (
                        <span className="text-sm text-muted-foreground">
                            ({transactions.length})
                        </span>
                    )}
                    {grouped && groupedTransactions.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleAllGroups}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title={allExpanded ? "Colapsar todos" : "Expandir todos"}
                        >
                            <ChevronsUpDown className="w-4 h-4 mr-1" />
                            {allExpanded ? "Colapsar" : "Expandir"}
                        </Button>
                    )}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'amount')}>
                        <SelectTrigger className="w-[110px] h-9">
                            <Filter className="w-4 h-4 mr-1" />
                            <SelectValue placeholder="Ordenar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="amount">Valor</SelectItem>
                        </SelectContent>
                    </Select>

                    {!mobileOptimized && (
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <Download className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className={cn(
                maxHeight && "flex-1 overflow-y-auto"
            )}>
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? 'Nenhuma transação encontrada para esta busca.' : 'Nenhuma transação encontrada.'}
                    </div>
                ) : grouped ? (
                    renderGroupedList()
                ) : (
                    renderFlatList()
                )}
            </div>
        </div>
    );
};
