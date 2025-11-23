import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/PageTransition';
import { InvoiceStatusCard } from '@/components/credit-cards/InvoiceStatusCard';
import { InvoiceTransactionList } from '@/components/credit-cards/InvoiceTransactionList';
import { listCreditCards, getCreditCardInvoice } from '@/api/creditCards';
import { CreditCard, InvoiceResponse } from '@/types/api';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function FuturePlanningPage() {
    const [, setLocation] = useLocation();
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // Format: "YYYY-MM"
    const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Generate next 12 months options
    const monthOptions = Array.from({ length: 12 }, (_, i) => {
        const date = addMonths(new Date(), i + 1); // Start from next month
        return {
            value: format(date, 'yyyy-MM'),
            label: format(date, 'MMMM yyyy', { locale: ptBR }),
        };
    });

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

    // Set default month
    useEffect(() => {
        if (!selectedMonth && monthOptions.length > 0) {
            setSelectedMonth(monthOptions[0].value);
        }
    }, [monthOptions]);

    // Load Invoice
    useEffect(() => {
        const loadInvoice = async () => {
            if (!selectedCardId || !selectedMonth || !currentOrg?.id) return;

            try {
                setIsLoading(true);
                const [year, month] = selectedMonth.split('-');
                const data = await getCreditCardInvoice(
                    Number(selectedCardId),
                    Number(year),
                    Number(month),
                    currentOrg.id
                );
                setInvoice(data);
            } catch (error) {
                console.error('Failed to load invoice:', error);
                setInvoice(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadInvoice();
    }, [selectedCardId, selectedMonth, currentOrg?.id]);

    return (
        <PageTransition>
            <div className="container mx-auto p-6 max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation('/credit-cards')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Planejamento Futuro</h1>
                        <p className="text-muted-foreground">Visualize suas parcelas futuras</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Cartão</label>
                        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um cartão" />
                            </SelectTrigger>
                            <SelectContent>
                                {cards.map((card) => (
                                    <SelectItem key={card.id} value={String(card.id)}>
                                        {card.description || `Cartão final ${card.last4}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Mês de Referência</label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger>
                                <CalendarRange className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Selecione o mês" />
                            </SelectTrigger>
                            <SelectContent>
                                {monthOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        <span className="capitalize">{option.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 h-[300px]">
                        <InvoiceStatusCard invoice={invoice} isLoading={isLoading} />
                    </div>

                    <div className="lg:col-span-2">
                        <InvoiceTransactionList
                            transactions={invoice?.items || []}
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}
