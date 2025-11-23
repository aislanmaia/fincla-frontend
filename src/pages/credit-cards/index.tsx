import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/PageTransition';
import { CreditCardSelector } from '@/components/credit-cards/CreditCardSelector';
import { InvoiceStatusCard } from '@/components/credit-cards/InvoiceStatusCard';
import { InvoiceTransactionList } from '@/components/credit-cards/InvoiceTransactionList';
import { listCreditCards, getCreditCardInvoice, deleteCreditCard } from '@/api/creditCards';
import { CardFormDialog } from '@/components/credit-cards/CardFormDialog';
import { InvoiceCharts } from '@/components/credit-cards/InvoiceCharts';
import { CreditCard, InvoiceResponse } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarRange, History, ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditCardsPage() {
    const [location, setLocation] = useLocation();
    const { user } = useAuth();
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
    const [currentInvoice, setCurrentInvoice] = useState<InvoiceResponse | null>(null);

    const [isLoadingCards, setIsLoadingCards] = useState(true);
    const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
    const [isCardFormOpen, setIsCardFormOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

    // Load Cards
    useEffect(() => {
        const loadCards = async () => {
            if (!currentOrg?.id) return;

            try {
                setIsLoadingCards(true);
                const data = await listCreditCards(currentOrg.id);
                setCards(data);

                // Select first card by default if none selected
                if (data.length > 0 && !selectedCardId) {
                    setSelectedCardId(data[0].id);
                }
            } catch (error) {
                console.error('Failed to load credit cards:', error);
                toast.error('Erro ao carregar cartões de crédito');
            } finally {
                setIsLoadingCards(false);
            }
        };

        loadCards();
    }, [currentOrg?.id]);

    // Load Invoice when card changes
    useEffect(() => {
        const loadInvoice = async () => {
            if (!selectedCardId || !currentOrg?.id) return;

            try {
                setIsLoadingInvoice(true);
                const now = new Date();
                const invoice = await getCreditCardInvoice(
                    selectedCardId,
                    now.getFullYear(),
                    now.getMonth() + 1, // API expects 1-12
                    currentOrg.id
                );
                setCurrentInvoice(invoice);
            } catch (error) {
                console.error('Failed to load invoice:', error);
                // Don't show error toast here as it might just be empty invoice
                setCurrentInvoice(null);
            } finally {
                setIsLoadingInvoice(false);
            }
        };

        loadInvoice();
    }, [selectedCardId, currentOrg?.id]);

    const handleAddCard = () => {
        setCardToEdit(null);
        setIsCardFormOpen(true);
    };

    const handleEditCard = (card: CreditCard) => {
        setCardToEdit(card);
        setIsCardFormOpen(true);
    };

    const handleDeleteCard = async (cardId: number) => {
        if (!currentOrg?.id) return;

        if (!confirm('Tem certeza que deseja excluir este cartão?')) return;

        try {
            await deleteCreditCard(cardId, currentOrg.id);
            toast.success('Cartão excluído com sucesso!');
            // Reload cards
            const data = await listCreditCards(currentOrg.id);
            setCards(data);
            // If deleted card was selected, select first card or null
            if (selectedCardId === cardId) {
                setSelectedCardId(data.length > 0 ? data[0].id : null);
            }
        } catch (error) {
            console.error('Failed to delete card:', error);
            toast.error('Erro ao excluir cartão');
        }
    };

    const handleCardFormSuccess = async () => {
        if (!currentOrg?.id) return;
        // Reload cards
        const data = await listCreditCards(currentOrg.id);
        setCards(data);
        // If no card selected and we have cards, select first
        if (!selectedCardId && data.length > 0) {
            setSelectedCardId(data[0].id);
        }
    };

    return (
        <PageTransition>
            <div className="container mx-auto p-6 max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
                        <p className="text-muted-foreground">Gerencie suas faturas e limites</p>
                    </div>
                    <Button onClick={handleAddCard}>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Cartão
                    </Button>
                </div>

                {/* Card Selector */}
                <section>
                    <CreditCardSelector
                        cards={cards}
                        selectedCardId={selectedCardId}
                        onSelectCard={setSelectedCardId}
                        onAddCard={handleAddCard}
                        onEditCard={handleEditCard}
                        onDeleteCard={handleDeleteCard}
                    />
                </section>

                {selectedCardId ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Status & Portals */}
                        <div className="space-y-8 lg:col-span-1">
                            <div className="h-[300px]">
                                <InvoiceStatusCard
                                    invoice={currentInvoice}
                                    isLoading={isLoadingInvoice}
                                />
                            </div>

                            {/* Portal Cards */}
                            <div className="grid grid-cols-1 gap-4">
                                <Card
                                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                    onClick={() => setLocation('/credit-cards/history')}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                                                <History className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">Histórico de Faturas</h3>
                                                <p className="text-xs text-muted-foreground">Ver faturas anteriores</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                </Card>

                                <Card
                                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                    onClick={() => setLocation('/credit-cards/planning')}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                                                <CalendarRange className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">Planejamento Futuro</h3>
                                                <p className="text-xs text-muted-foreground">Projeção de parcelas</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* Right Column: Transactions & Charts */}
                        <div className="lg:col-span-2 space-y-8">
                            <InvoiceCharts
                                currentInvoice={currentInvoice}
                                isLoading={isLoadingInvoice}
                            />

                            <InvoiceTransactionList
                                transactions={currentInvoice?.items || []}
                                isLoading={isLoadingInvoice}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        {isLoadingCards ? 'Carregando cartões...' : 'Nenhum cartão selecionado. Adicione ou selecione um cartão para ver os detalhes.'}
                    </div>
                )}
            </div>

            {/* Card Form Dialog */}
            <CardFormDialog
                open={isCardFormOpen}
                onOpenChange={setIsCardFormOpen}
                cardToEdit={cardToEdit}
                onSuccess={handleCardFormSuccess}
            />
        </PageTransition>
    );
}
