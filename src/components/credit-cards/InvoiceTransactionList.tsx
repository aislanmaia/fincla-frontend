import React, { useState } from 'react';
import { InvoiceItemResponse } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Tag as TagIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InvoiceTransactionListProps {
    transactions: InvoiceItemResponse[];
    isLoading: boolean;
}

export const InvoiceTransactionList: React.FC<InvoiceTransactionListProps> = ({
    transactions,
    isLoading,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

    const filteredTransactions = transactions
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

    if (isLoading) {
        return <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
        </div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <h3 className="text-lg font-semibold w-full sm:w-auto">Transações</h3>

                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'amount')}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Ordenar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="amount">Valor</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada.
                    </div>
                ) : (
                    filteredTransactions.map((transaction) => (
                        <Card key={transaction.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <span className="text-xs font-bold text-gray-500 uppercase">
                                        {format(new Date(transaction.transaction_date), 'MMM', { locale: ptBR })}
                                    </span>
                                    <span className="text-lg font-bold">
                                        {format(new Date(transaction.transaction_date), 'dd')}
                                    </span>
                                </div>

                                <div>
                                    <div className="font-medium">{transaction.description}</div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {transaction.total_installments > 1 && (
                                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-medium">
                                                {transaction.installment_number}/{transaction.total_installments}
                                            </span>
                                        )}

                                        {/* Category Tag */}
                                        {transaction.tags?.['categoria']?.[0] ? (
                                            <span
                                                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                                style={{
                                                    backgroundColor: `${transaction.tags['categoria'][0].color}20`,
                                                    color: transaction.tags['categoria'][0].color || 'currentColor'
                                                }}
                                            >
                                                {transaction.tags['categoria'][0].name}
                                            </span>
                                        ) : (
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-orange-500 hover:text-orange-600 hover:bg-orange-50">
                                                <TagIcon className="w-3 h-3 mr-1" />
                                                Classificar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="font-bold text-right">
                                {formatCurrency(transaction.amount)}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
