import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { InvoiceResponse } from '@/types/api';
import { formatCurrency, cn } from '@/lib/utils';
import { generateDistinctCategoryColors } from '@/lib/colorGenerator';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CategoryAnalysisProps {
    currentInvoice: InvoiceResponse | null;
    previousMonthTotal?: number | null;
    monthOverMonthChange?: number | null;
    isLoading?: boolean;
    className?: string;
}

export const CategoryAnalysis: React.FC<CategoryAnalysisProps> = ({
    currentInvoice,
    previousMonthTotal,
    monthOverMonthChange,
    isLoading,
    className,
}) => {
    // Processar dados de categoria - usa category_breakdown do backend se disponível
    const categoryData = useMemo(() => {
        let categories: Array<{ name: string; value: number; percentage: number; count?: number }> = [];
        
        // Se o backend já retorna category_breakdown, agrupa por nome para evitar duplicatas
        if (currentInvoice?.category_breakdown && currentInvoice.category_breakdown.length > 0) {
            // Agrupar categorias por nome (caso o backend retorne duplicatas)
            const categoryMap = new Map<string, { total: number; count: number }>();
            
            currentInvoice.category_breakdown.forEach(cat => {
                const categoryName = cat.category_name;
                const existing = categoryMap.get(categoryName) || { total: 0, count: 0 };
                categoryMap.set(categoryName, {
                    total: existing.total + cat.total,
                    count: existing.count + cat.transaction_count
                });
            });
            
            // Converter para array e recalcular porcentagens
            const totalAmount = currentInvoice.total_amount || 0;
            categories = Array.from(categoryMap.entries())
                .map(([name, data]) => ({
                    name,
                    value: data.total,
                    percentage: totalAmount > 0 ? (data.total / totalAmount * 100) : 0,
                    count: data.count
                }))
                .sort((a, b) => b.value - a.value);
        } else if (currentInvoice?.items) {
            // Fallback: calcula a partir dos items (compatibilidade com backend antigo)
            const categoryMap = new Map<string, number>();

            currentInvoice.items.forEach((item) => {
                const categoryTag = item.tags?.['categoria']?.[0] || item.tags?.['category']?.[0];
                const categoryName = categoryTag?.name || 'Sem Categoria';
                categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + item.amount);
            });

            categories = Array.from(categoryMap.entries())
                .map(([name, value]) => ({ 
                    name, 
                    value,
                    percentage: currentInvoice.total_amount > 0 
                        ? (value / currentInvoice.total_amount * 100) 
                        : 0
                }))
                .sort((a, b) => b.value - a.value);
        } else {
            return [];
        }

        // SEMPRE gerar cores distintas no frontend para garantir que cada categoria tenha cor única
        // Isso garante diferenciação visual mesmo se o backend retornar cores iguais
        const categoryNames = categories.map(c => c.name);
        const colorMap = generateDistinctCategoryColors(categoryNames);

        return categories.map(cat => ({
            ...cat,
            color: colorMap.get(cat.name) || '#6B7280'
        }));
    }, [currentInvoice]);

    // Calcular média mensal (placeholder - virá do backend)
    const averageMonthly = previousMonthTotal 
        ? (currentInvoice?.total_amount || 0 + previousMonthTotal) / 2 
        : currentInvoice?.total_amount || 0;

    if (isLoading) {
        return (
            <Card className={cn("p-5 h-full", className)}>
                <div className="animate-pulse space-y-4">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    if (!currentInvoice || categoryData.length === 0) {
        return (
            <Card className={cn("p-5 h-full flex items-center justify-center", className)}>
                <p className="text-muted-foreground text-center">
                    Nenhum dado disponível para análise
                </p>
            </Card>
        );
    }

    return (
        <Card className={cn("p-5 h-full flex flex-col", className)}>
            {/* Header */}
            <h3 className="text-base font-semibold mb-4">ANÁLISE DE GASTOS</h3>

            {/* Categorias com barras */}
            <div className="flex-1 space-y-3">
                {categoryData.slice(0, 5).map((cat) => (
                    <div key={cat.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <div 
                                    className="w-3 h-3 rounded-sm flex-shrink-0" 
                                    style={{ backgroundColor: cat.color }} 
                                />
                                <span className="truncate">{cat.name}</span>
                            </div>
                            <span className="font-medium text-muted-foreground ml-2">
                                {cat.percentage.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
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
                    <p className="text-xs text-muted-foreground text-center pt-1">
                        +{categoryData.length - 5} outras categorias
                    </p>
                )}
            </div>

            {/* Footer: Comparativo */}
            <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Média mensal:</span>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">
                            {formatCurrency(averageMonthly)}
                        </span>
                        {monthOverMonthChange !== null && monthOverMonthChange !== undefined && (
                            <div className={cn(
                                "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
                                monthOverMonthChange > 0 
                                    ? "text-red-600 bg-red-50 dark:bg-red-900/20" 
                                    : monthOverMonthChange < 0 
                                        ? "text-green-600 bg-green-50 dark:bg-green-900/20"
                                        : "text-gray-600 bg-gray-50 dark:bg-gray-800"
                            )}>
                                {monthOverMonthChange > 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                ) : monthOverMonthChange < 0 ? (
                                    <TrendingDown className="w-3 h-3" />
                                ) : (
                                    <Minus className="w-3 h-3" />
                                )}
                                {Math.abs(monthOverMonthChange).toFixed(0)}%
                            </div>
                        )}
                    </div>
                </div>
                {monthOverMonthChange !== null && monthOverMonthChange !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                        vs. mês anterior
                    </p>
                )}
            </div>
        </Card>
    );
};

