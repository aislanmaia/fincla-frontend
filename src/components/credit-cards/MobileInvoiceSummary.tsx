import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InvoiceResponse } from '@/types/api';
import { formatCurrency } from '@/lib/utils';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileInvoiceSummaryProps {
    invoice: InvoiceResponse | null;
    isLoading?: boolean;
    currentYear?: number;
    currentMonth?: number;
    onNavigateMonth?: (direction: 'prev' | 'next') => void;
    canNavigatePrev?: boolean;
    canNavigateNext?: boolean;
}

export const MobileInvoiceSummary: React.FC<MobileInvoiceSummaryProps> = ({
    invoice,
    isLoading,
    currentYear,
    currentMonth,
    onNavigateMonth,
    canNavigatePrev = true,
    canNavigateNext = true,
}) => {
    const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'default';
            case 'open': return 'secondary';
            case 'overdue': return 'destructive';
            case 'closed': return 'outline';
            default: return 'secondary';
        }
    };

    const getStatusLabel = (status?: string): string => {
        switch (status) {
            case 'paid': return 'Paga';
            case 'open': return 'Aberta';
            case 'overdue': return 'Vencida';
            case 'closed': return 'Fechada';
            default: return 'Aberta';
        }
    };

    const getStatusColor = (status?: string): string => {
        switch (status) {
            case 'paid': return 'bg-green-500';
            case 'open': return 'bg-blue-500';
            case 'overdue': return 'bg-red-500';
            case 'closed': return 'bg-gray-500';
            default: return 'bg-blue-500';
        }
    };

    // Calcular dias até vencimento (versão frontend, será substituído pelo backend)
    const calculateDaysUntilDue = (dueDate?: string): number => {
        if (!dueDate) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const daysUntilDue = invoice ? calculateDaysUntilDue(invoice.due_date) : 0;

    // Obter nome do mês para exibição
    const getMonthDisplay = () => {
        if (invoice?.month) return invoice.month;
        if (currentYear && currentMonth) {
            const date = new Date(currentYear, currentMonth - 1);
            return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        }
        return 'Período';
    };

    if (isLoading) {
        return (
            <Card className="p-4">
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4">
            {/* Header com navegação de mês */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {onNavigateMonth && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onNavigateMonth('prev')}
                            disabled={!canNavigatePrev}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <span className="text-sm font-medium text-muted-foreground capitalize">
                        {getMonthDisplay()}
                    </span>
                    {onNavigateMonth && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onNavigateMonth('next')}
                            disabled={!canNavigateNext}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                
                {invoice && (
                    <Badge 
                        variant={getStatusVariant(invoice.status)}
                        className={cn(
                            "text-xs",
                            invoice.status === 'paid' && "bg-green-500 hover:bg-green-600"
                        )}
                    >
                        {getStatusLabel(invoice.status)}
                    </Badge>
                )}
            </div>

            {invoice ? (
                <>
                    {/* Valor principal */}
                    <div className="mb-3">
                        <span className="text-3xl font-bold tracking-tight">
                            {formatCurrency(invoice.total_amount)}
                        </span>
                    </div>

                    {/* Info de vencimento */}
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>Vence: {new Date(invoice.due_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        
                        {invoice.status !== 'paid' && (
                            <div className={cn(
                                "flex items-center gap-1 text-sm font-medium",
                                daysUntilDue < 0 ? "text-red-500" :
                                daysUntilDue <= 3 ? "text-orange-500" :
                                daysUntilDue <= 7 ? "text-yellow-600" :
                                "text-muted-foreground"
                            )}>
                                <Clock className="w-4 h-4" />
                                <span>
                                    {daysUntilDue < 0 
                                        ? `${Math.abs(daysUntilDue)}d atraso`
                                        : daysUntilDue === 0 
                                            ? 'Vence hoje'
                                            : daysUntilDue === 1
                                                ? 'Vence amanhã'
                                                : `${daysUntilDue}d restantes`
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">Nenhuma fatura encontrada para este período.</p>
                </div>
            )}
        </Card>
    );
};

