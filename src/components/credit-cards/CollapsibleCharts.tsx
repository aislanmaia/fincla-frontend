import React, { useMemo } from 'react';
import { InvoiceResponse } from '@/types/api';
import { formatCurrency } from '@/lib/utils';
import { ChevronDown, PieChart } from 'lucide-react';
import { generateDistinctCategoryColors } from '@/lib/colorGenerator';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

interface CollapsibleChartsProps {
    currentInvoice: InvoiceResponse | null;
    isLoading?: boolean;
    defaultOpen?: boolean;
}

export const CollapsibleCharts: React.FC<CollapsibleChartsProps> = ({
    currentInvoice,
    isLoading,
    defaultOpen = false,
}) => {
    // Processar dados de categoria
    const categoryData = useMemo(() => {
        if (!currentInvoice?.items) return [];

        const categoryMap = new Map<string, { total: number; count: number }>();

        currentInvoice.items.forEach((item) => {
            const categoryTag = item.tags?.['categoria']?.[0] || item.tags?.['category']?.[0];
            const categoryName = categoryTag?.name || 'Sem Categoria';

            const current = categoryMap.get(categoryName) || { total: 0, count: 0 };
            categoryMap.set(categoryName, {
                total: current.total + item.amount,
                count: current.count + 1,
            });
        });

        const categories = Array.from(categoryMap.entries())
            .map(([name, data]) => ({ 
                name, 
                value: data.total,
                count: data.count,
                percentage: currentInvoice.total_amount > 0 
                    ? (data.total / currentInvoice.total_amount * 100) 
                    : 0
            }))
            .sort((a, b) => b.value - a.value);

        // Gerar cores distintas
        const categoryNames = categories.map(c => c.name);
        const colorMap = generateDistinctCategoryColors(categoryNames);

        return categories.map(cat => ({
            ...cat,
            color: colorMap.get(cat.name) || '#6B7280'
        }));
    }, [currentInvoice]);

    // Top 5 comerciantes
    const topMerchants = useMemo(() => {
        if (!currentInvoice?.items) return [];

        const merchantMap = new Map<string, number>();

        currentInvoice.items.forEach((item) => {
            const description = item.description || 'Sem Descrição';
            merchantMap.set(description, (merchantMap.get(description) || 0) + item.amount);
        });

        return Array.from(merchantMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [currentInvoice]);

    if (isLoading) {
        return (
            <div className="p-4 bg-card rounded-lg border">
                <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                </div>
            </div>
        );
    }

    if (!currentInvoice || categoryData.length === 0) {
        return null;
    }

    return (
        <Accordion 
            type="single" 
            collapsible 
            defaultValue={defaultOpen ? "analysis" : undefined}
            className="bg-card rounded-lg border"
        >
            <AccordionItem value="analysis" className="border-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <PieChart className="w-4 h-4 text-muted-foreground" />
                        <span>Ver análise de gastos</span>
                        <span className="text-muted-foreground font-normal">
                            ({categoryData.length} categorias)
                        </span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    {/* Categorias com barras */}
                    <div className="space-y-3 mb-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Por Categoria
                        </h4>
                        {categoryData.slice(0, 5).map((cat) => (
                            <div key={cat.name} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-3 h-3 rounded-full flex-shrink-0" 
                                            style={{ backgroundColor: cat.color }} 
                                        />
                                        <span className="truncate max-w-[120px]">{cat.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs">
                                            {cat.percentage.toFixed(0)}%
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(cat.value)}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ 
                                            width: `${cat.percentage}%`, 
                                            backgroundColor: cat.color 
                                        }} 
                                    />
                                </div>
                            </div>
                        ))}
                        {categoryData.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                                +{categoryData.length - 5} outras categorias
                            </p>
                        )}
                    </div>

                    {/* Top comerciantes */}
                    {topMerchants.length > 0 && (
                        <div className="space-y-2 pt-3 border-t">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Maiores Gastos
                            </h4>
                            {topMerchants.slice(0, 3).map((merchant, index) => (
                                <div 
                                    key={merchant.name} 
                                    className="flex items-center justify-between text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="truncate max-w-[150px]">{merchant.name}</span>
                                    </div>
                                    <span className="font-medium">{formatCurrency(merchant.value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

