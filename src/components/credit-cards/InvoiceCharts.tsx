import React from 'react';
import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { InvoiceResponse } from '@/types/api';
import { TrendingUp, Store } from 'lucide-react';

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 h-[300px] flex items-center justify-center">
                    <div className="text-muted-foreground">Carregando dados...</div>
                </Card>
                <Card className="p-6 h-[300px] flex items-center justify-center">
                    <div className="text-muted-foreground">Carregando dados...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Donut Chart */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Gastos por Categoria
                    </h3>
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
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
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            Nenhum dado disponível
                        </div>
                    )}
                </Card>

                {/* Monthly Comparison */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Comparativo Mensal</h3>
                    {monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={monthlyData}>
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="total" fill="#4A56E2" name="Total da Fatura" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            Carregue o histórico para ver a comparação
                        </div>
                    )}
                </Card>
            </div>

            {/* Top Merchants */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary" />
                    Top 5 Estabelecimentos
                </h3>
                {topMerchants.length > 0 ? (
                    <div className="space-y-3">
                        {topMerchants.map((merchant, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                        {index + 1}
                                    </div>
                                    <span className="font-medium">{merchant.name}</span>
                                </div>
                                <span className="font-bold text-lg">{formatCurrency(merchant.value)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        Nenhum dado disponível
                    </div>
                )}
            </Card>
        </div>
    );
};
