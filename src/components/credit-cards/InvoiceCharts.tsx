import React from 'react';
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { InvoiceResponse } from '@/types/api';
import { TrendingUp, Store, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InvoiceChartsProps {
    currentInvoice: InvoiceResponse | null;
    monthlyData?: { month: string; total: number }[];
    isLoading?: boolean;
}

const COLORS = ['#4A56E2', '#00C6B8', '#FF6B6B', '#FFA500', '#9B59B6', '#3498DB', '#E74C3C', '#1ABC9C'];

export const InvoiceCharts: React.FC<InvoiceChartsProps> = ({
    currentInvoice,
    monthlyData = [],
    isLoading = false,
}) => {
    // Process category data from current invoice
    const categoryData = React.useMemo(() => {
        if (!currentInvoice?.items) return [];

        const categoryMap = new Map<string, number>();

        currentInvoice.items.forEach((item) => {
            // Extract category from tags
            const categoryTag = item.tags?.['categoria']?.[0] || item.tags?.['category']?.[0];
            const categoryName = categoryTag?.name || 'Sem Categoria';

            categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + item.amount);
        });

        return Array.from(categoryMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [currentInvoice]);

    // Process top merchants/descriptions
    const topMerchants = React.useMemo(() => {
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    if (isLoading) {
        return (
            <Card className="p-6 h-[300px] flex items-center justify-center">
                <div className="text-muted-foreground">Carregando insights...</div>
            </Card>
        );
    }

    return (
        <Card className="p-6 h-full min-h-[320px]">
            <div className="mb-4">
                <h3 className="text-lg font-semibold">Insights Area</h3>
            </div>

            <Tabs defaultValue="fatura" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="fatura">Fatura</TabsTrigger>
                    <TabsTrigger value="historico">Histórico</TabsTrigger>
                    <TabsTrigger value="lojas">Top Lojas</TabsTrigger>
                </TabsList>

                <TabsContent value="fatura" className="mt-0">
                    <div className="h-[200px] w-full">
                        {categoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={(entry) => entry.name}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Nenhum dado disponível
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="historico" className="mt-0">
                    <div className="h-[200px] w-full">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <XAxis dataKey="month" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Bar dataKey="total" fill="#4A56E2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Histórico indisponível
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="lojas" className="mt-0">
                    <div className="h-[200px] overflow-y-auto pr-2">
                        {topMerchants.length > 0 ? (
                            <div className="space-y-3">
                                {topMerchants.map((merchant, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {index + 1}
                                            </div>
                                            <span className="font-medium truncate max-w-[120px]">{merchant.name}</span>
                                        </div>
                                        <span className="font-semibold">{formatCurrency(merchant.value)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Nenhuma transação
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </Card>
    );
};
