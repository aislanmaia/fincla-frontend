import React, { useMemo, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { InvoiceResponse, CreditCard } from '@/types/api';
import { formatCurrency } from '@/lib/utils';
import { Calendar, CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

interface InvoiceStatusCardProps {
    invoice: InvoiceResponse | null;
    card?: CreditCard | null;
    isLoading: boolean;
    onNavigateMonth?: (direction: 'prev' | 'next') => void;
    onSelectMonth?: (year: number, month: number) => void;
    canNavigatePrev?: boolean;
    canNavigateNext?: boolean;
    currentYear?: number;
    currentMonth?: number;
    onMarkAsPaid?: () => void;
    onUnmarkAsPaid?: () => void;
    isPaid?: boolean;
}

// Custom SelectContent with scrollbar and auto-centering
const CustomSelectContent = React.forwardRef<
    React.ElementRef<typeof SelectPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & { currentValue?: string }
>(({ className, children, currentValue, ...props }, ref) => {
    const selectContentRef = useRef<HTMLDivElement>(null);

    // Scroll to selected item when dropdown opens - centraliza o item selecionado
    useEffect(() => {
        const scrollToSelected = () => {
            const viewport = selectContentRef.current?.querySelector('[data-radix-select-viewport]') as HTMLElement;
            // Tenta múltiplas formas de encontrar o item selecionado
            const selectedItem = 
                selectContentRef.current?.querySelector(`[data-value="${currentValue}"]`) as HTMLElement ||
                selectContentRef.current?.querySelector('[data-state="checked"]') as HTMLElement ||
                selectContentRef.current?.querySelector('[data-radix-select-item][data-state="checked"]') as HTMLElement;
            
            if (viewport && selectedItem) {
                // Calcula para centralizar o item no meio do viewport
                const itemOffsetTop = selectedItem.offsetTop;
                const viewportHeight = viewport.clientHeight;
                const itemHeight = selectedItem.offsetHeight;
                
                // Centraliza: topo do item - (metade do viewport - metade do item)
                const targetScrollTop = itemOffsetTop - (viewportHeight / 2) + (itemHeight / 2);
                
                // Aplica o scroll diretamente
                viewport.scrollTop = targetScrollTop;
            }
        };
        
        // Múltiplas tentativas para garantir que funciona após a animação do Radix
        const timeouts: NodeJS.Timeout[] = [];
        timeouts.push(setTimeout(scrollToSelected, 10));
        timeouts.push(setTimeout(scrollToSelected, 50));
        timeouts.push(setTimeout(scrollToSelected, 150));
        timeouts.push(setTimeout(scrollToSelected, 300));
        
        return () => {
            timeouts.forEach(timeout => clearTimeout(timeout));
        };
    }, [currentValue]);

    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                ref={(node) => {
                    if (typeof ref === 'function') ref(node);
                    else if (ref) (ref as any).current = node;
                    (selectContentRef as any).current = node;
                }}
                className={cn(
                    "relative z-50 h-[240px] border-none shadow-md rounded-lg bg-card text-card-foreground overflow-hidden",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-100",
                    className
                )}
                position="popper"
                side="bottom"
                align="center"
                sideOffset={4}
                collisionPadding={8}
                {...props}
            >
                <SelectPrimitive.Viewport 
                    className="h-full overflow-y-scroll p-0"
                >
                    {children}
                </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
});
CustomSelectContent.displayName = 'CustomSelectContent';

export const InvoiceStatusCard: React.FC<InvoiceStatusCardProps> = ({
    invoice,
    card,
    isLoading,
    onNavigateMonth,
    onSelectMonth,
    canNavigatePrev = true,
    canNavigateNext = true,
    currentYear,
    currentMonth,
    onMarkAsPaid,
    onUnmarkAsPaid,
    isPaid = false,
}) => {
    // Generate month options (current month ± 12 months = 25 months total)
    const monthOptions = useMemo(() => {
        if (!currentYear || !currentMonth) return [];
        
        const options: Array<{ value: string; label: string; year: number; month: number }> = [];
        const baseDate = new Date(currentYear, currentMonth - 1);
        
        // Generate 12 months before and 12 months after (25 total)
        for (let i = -12; i <= 12; i++) {
            const date = addMonths(baseDate, i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const label = format(date, 'MMMM yyyy', { locale: ptBR });
            const value = `${year}-${month.toString().padStart(2, '0')}`;
            
            options.push({ value, label, year, month });
        }
        
        return options;
    }, [currentYear, currentMonth]);
    
    const currentValue = currentYear && currentMonth 
        ? `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
        : '';
    
    const [isOpen, setIsOpen] = React.useState(false);
    
    if (isLoading) {
        return (
            <Card className="p-6 h-full flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </Card>
        );
    }

    // Get month name for display
    const getMonthDisplay = () => {
        if (invoice) {
            return invoice.month;
        }
        if (currentYear && currentMonth) {
            const date = new Date(currentYear, currentMonth - 1);
            return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        }
        return 'Período';
    };

    const renderSelectItem = (option: { value: string; label: string }) => (
        <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn(
                "py-2.5 px-4 text-center cursor-pointer rounded-md border-none outline-none transition-colors",
                "flex items-center justify-center [&>span:first-child]:hidden",
                // Item selecionado - fundo primary com opacidade
                option.value === currentValue && "font-semibold text-primary bg-primary/10",
                // Hover e highlighted state (Radix)
                "data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900",
                "dark:data-[highlighted]:bg-white/10 dark:data-[highlighted]:text-white",
                "hover:bg-slate-100 dark:hover:bg-white/10"
            )}
        >
            {option.label}
        </SelectItem>
    );

    if (!invoice) {
        return (
            <Card className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 pointer-events-none bg-gray-500" />

                <div>
                    <div className="mb-6 space-y-3">
                        {/* Title row with navigation - full width */}
                        <div className="flex items-center gap-2 w-full">
                            {onNavigateMonth && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => onNavigateMonth('prev')}
                                    disabled={!canNavigatePrev}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            )}
                            {onSelectMonth && monthOptions.length > 0 ? (
                                <Select
                                    value={currentValue}
                                    onValueChange={(value) => {
                                        const option = monthOptions.find(opt => opt.value === value);
                                        if (option) {
                                            onSelectMonth(option.year, option.month);
                                        }
                                    }}
                                    onOpenChange={setIsOpen}
                                >
                                <SelectTrigger className="flex-1 !border-0 border-none !outline-none shadow-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 h-auto p-0 [&>span]:flex-1 [&>span]:block [&>span]:overflow-visible [&>span]:whitespace-normal [&>span]:[line-clamp:unset!important] [&>span]:[-webkit-line-clamp:unset!important]">
                                    <SelectValue>
                                        <h2 className="text-lg font-semibold text-muted-foreground text-center cursor-pointer hover:text-foreground transition-colors whitespace-normal overflow-visible">
                                            Fatura de {getMonthDisplay()}
                                        </h2>
                                    </SelectValue>
                                </SelectTrigger>
                                    <CustomSelectContent currentValue={currentValue}>
                                        {monthOptions.map(renderSelectItem)}
                                    </CustomSelectContent>
                                </Select>
                            ) : (
                                <h2 className="text-lg font-semibold text-muted-foreground flex-1 text-center">
                                    Fatura de {getMonthDisplay()}
                                </h2>
                            )}
                            {onNavigateMonth && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => onNavigateMonth('next')}
                                    disabled={!canNavigateNext}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Empty state message */}
                    <div className="mb-8 flex flex-col items-center justify-center text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-center">Nenhuma fatura encontrada para este período.</p>
                    </div>
                </div>

                {/* Empty space for layout consistency */}
                <div></div>
            </Card>
        );
    }

    // Funções de estilo considerando o campo is_overdue
    const getStatusColor = (status: string, isOverdue?: boolean) => {
        if (isOverdue) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
        switch (status) {
            case 'open': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
            case 'closed': return 'text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400';
            case 'paid': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getStatusLabel = (status: string, isOverdue?: boolean) => {
        if (isOverdue) return 'Vencida';
        switch (status) {
            case 'open': return 'Fatura Aberta';
            case 'closed': return 'Fatura Fechada';
            case 'paid': return 'Paga';
            default: return status;
        }
    };

    const getStatusIcon = (status: string, isOverdue?: boolean) => {
        if (isOverdue) return <AlertCircle className="w-5 h-5" />;
        switch (status) {
            case 'open': return <Clock className="w-5 h-5" />;
            case 'closed': return <CheckCircle className="w-5 h-5" />;
            case 'paid': return <CheckCircle className="w-5 h-5" />;
            default: return <Clock className="w-5 h-5" />;
        }
    };

    return (
        <Card className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Background decoration */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 pointer-events-none",
                invoice.status === 'open' ? "bg-blue-500" :
                    invoice.is_overdue ? "bg-red-500" :
                        invoice.status === 'paid' ? "bg-green-500" : "bg-gray-500"
            )} />

            <div>
                <div className="mb-6 space-y-3">
                    {/* Title row with navigation - full width */}
                    <div className="flex items-center gap-2 w-full">
                        {onNavigateMonth && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={() => onNavigateMonth('prev')}
                                disabled={!canNavigatePrev}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        )}
                        {onSelectMonth && monthOptions.length > 0 ? (
                            <Select
                                value={currentValue}
                                onValueChange={(value) => {
                                    const option = monthOptions.find(opt => opt.value === value);
                                    if (option) {
                                        onSelectMonth(option.year, option.month);
                                    }
                                }}
                                onOpenChange={setIsOpen}
                            >
                                <SelectTrigger className="flex-1 !border-0 border-none !outline-none shadow-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 h-auto p-0 [&>span]:flex-1 [&>span]:overflow-visible [&>span]:whitespace-normal [&>span]:[display:block!important] [&>span]:[line-clamp:unset!important] [&>span]:[-webkit-line-clamp:unset!important]">
                                    <SelectValue>
                                        <h2 className="text-lg font-semibold text-muted-foreground text-center cursor-pointer hover:text-foreground transition-colors whitespace-normal overflow-visible">
                                            Fatura de {invoice.month}
                                        </h2>
                                    </SelectValue>
                                </SelectTrigger>
                                <CustomSelectContent currentValue={currentValue}>
                                    {monthOptions.map(renderSelectItem)}
                                </CustomSelectContent>
                            </Select>
                        ) : (
                            <h2 className="text-lg font-semibold text-muted-foreground flex-1 text-center">
                                Fatura de {invoice.month}
                            </h2>
                        )}
                        {onNavigateMonth && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={() => onNavigateMonth('next')}
                                disabled={!canNavigateNext}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    
                    {/* Status badge row */}
                    <div className="flex justify-center">
                        <div className={cn(
                            "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                            getStatusColor(invoice.status, invoice.is_overdue)
                        )}>
                            {getStatusIcon(invoice.status, invoice.is_overdue)}
                            {getStatusLabel(invoice.status, invoice.is_overdue)}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <span className="text-4xl font-bold tracking-tight">
                        {formatCurrency(invoice.total_amount)}
                    </span>
                    
                    {/* Comparativo com mês anterior */}
                    {invoice.month_over_month_change !== null && invoice.month_over_month_change !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            {invoice.month_over_month_change > 0 ? (
                                <TrendingUp className="w-4 h-4 text-red-500" />
                            ) : invoice.month_over_month_change < 0 ? (
                                <TrendingDown className="w-4 h-4 text-green-500" />
                            ) : (
                                <Minus className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className={cn(
                                "text-sm font-medium",
                                invoice.month_over_month_change > 0 ? "text-red-500" :
                                invoice.month_over_month_change < 0 ? "text-green-500" : "text-muted-foreground"
                            )}>
                                {invoice.month_over_month_change > 0 ? '+' : ''}{invoice.month_over_month_change.toFixed(1)}%
                            </span>
                            <span className="text-xs text-muted-foreground">vs mês anterior</span>
                        </div>
                    )}
                </div>
                
                {/* Progress bar de uso do limite */}
                {(invoice.limit_usage_percent !== null && invoice.limit_usage_percent !== undefined) || (card?.limit_usage_percent !== null && card?.limit_usage_percent !== undefined) && (
                    <div className="mb-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Uso do limite</span>
                            <span className="font-medium">
                                {(invoice.limit_usage_percent ?? card?.limit_usage_percent ?? 0).toFixed(0)}%
                            </span>
                        </div>
                        <Progress 
                            value={invoice.limit_usage_percent ?? card?.limit_usage_percent ?? 0} 
                            className={cn(
                                "h-2",
                                (invoice.limit_usage_percent ?? card?.limit_usage_percent ?? 0) > 80 ? "[&>div]:bg-red-500" :
                                (invoice.limit_usage_percent ?? card?.limit_usage_percent ?? 0) > 50 ? "[&>div]:bg-yellow-500" :
                                "[&>div]:bg-green-500"
                            )}
                        />
                        {card?.credit_limit && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Disponível: {formatCurrency(card.available_limit ?? 0)}</span>
                                <span>Limite: {formatCurrency(card.credit_limit)}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center text-sm text-muted-foreground bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-lg">
                        <Calendar className="w-4 h-4 mr-2" />
                        Vence em: <span className="font-semibold ml-1 text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</span>
                    </div>
                    
                    {/* Dias até o vencimento */}
                    {invoice.days_until_due !== undefined && invoice.status !== 'paid' && (
                        <span className={cn(
                            "text-xs px-2 py-0.5 rounded",
                            invoice.is_overdue || invoice.days_until_due < 0 
                                ? "text-red-600 bg-red-50 dark:bg-red-900/20" 
                                : invoice.days_until_due <= 3 
                                    ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                                    : "text-muted-foreground"
                        )}>
                            {invoice.days_until_due < 0 
                                ? `Vencida há ${Math.abs(invoice.days_until_due)} dia${Math.abs(invoice.days_until_due) !== 1 ? 's' : ''}`
                                : invoice.days_until_due === 0 
                                    ? 'Vence hoje!'
                                    : `${invoice.days_until_due} dia${invoice.days_until_due !== 1 ? 's' : ''} para vencer`
                            }
                        </span>
                    )}
                </div>
                
                {onMarkAsPaid && invoice.status !== 'paid' && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onMarkAsPaid}
                        className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-900/20"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Marcar como Paga
                    </Button>
                )}
                
                {invoice.status === 'paid' && (
                    <div className="flex flex-col items-end gap-1">
                        {onUnmarkAsPaid ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onUnmarkAsPaid}
                                className="gap-1.5 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30"
                                title="Clique para desmarcar como paga"
                            >
                                <CheckCircle className="w-4 h-4" />
                                <span className="font-medium">Paga</span>
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                                <CheckCircle className="w-4 h-4" />
                                <span className="font-medium">Paga</span>
                            </div>
                        )}
                        {invoice.paid_date && (
                            <span className="text-xs text-muted-foreground">
                                em {new Date(invoice.paid_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};
