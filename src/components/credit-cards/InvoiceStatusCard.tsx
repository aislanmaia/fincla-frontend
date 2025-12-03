import React from 'react';
import { Card } from '@/components/ui/card';
import { InvoiceResponse } from '@/types/api';
import { formatCurrency } from '@/lib/utils';
import { Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceStatusCardProps {
    invoice: InvoiceResponse | null;
    isLoading: boolean;
}

export const InvoiceStatusCard: React.FC<InvoiceStatusCardProps> = ({
    invoice,
    isLoading,
}) => {
    if (isLoading) {
        return (
            <Card className="p-6 h-full flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </Card>
        );
    }

    if (!invoice) {
        return (
            <Card className="p-6 h-full flex flex-col items-center justify-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhuma fatura encontrada para este período.</p>
            </Card>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
            case 'closed': return 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400';
            case 'overdue': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
            case 'paid': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'open': return 'Fatura Aberta';
            case 'closed': return 'Fatura Fechada';
            case 'overdue': return 'Vencida';
            case 'paid': return 'Paga';
            default: return status;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'open': return <Clock className="w-5 h-5" />;
            case 'closed': return <CheckCircle className="w-5 h-5" />; // Ou outro ícone
            case 'overdue': return <AlertCircle className="w-5 h-5" />;
            case 'paid': return <CheckCircle className="w-5 h-5" />;
            default: return <Clock className="w-5 h-5" />;
        }
    };

    return (
        <Card className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Background decoration */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10",
                invoice.status === 'open' ? "bg-blue-500" :
                    invoice.status === 'overdue' ? "bg-red-500" :
                        invoice.status === 'paid' ? "bg-green-500" : "bg-gray-500"
            )} />

            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-muted-foreground">Fatura de {invoice.month}</h2>
                    <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                        getStatusColor(invoice.status)
                    )}>
                        {getStatusIcon(invoice.status)}
                        {getStatusLabel(invoice.status)}
                    </div>
                </div>

                <div className="mb-8">
                    <span className="text-4xl font-bold tracking-tight">
                        {formatCurrency(invoice.total_amount)}
                    </span>
                </div>
            </div>

            <div className="flex items-center text-sm text-muted-foreground bg-gray-50 dark:bg-white/5 p-3 rounded-lg w-fit">
                <Calendar className="w-4 h-4 mr-2" />
                Vence em: <span className="font-semibold ml-1 text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</span>
            </div>
        </Card>
    );
};
