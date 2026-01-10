import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/PageTransition';
import { InvoiceStatusCard } from '@/components/credit-cards/InvoiceStatusCard';
import { InvoiceTransactionList } from '@/components/credit-cards/InvoiceTransactionList';
import { InvoiceMonthSelector } from '@/components/credit-cards/InvoiceMonthSelector';
import { listCreditCards, getCreditCardInvoice, deleteCreditCard, markInvoicePaid, unmarkInvoicePaid } from '@/api/creditCards';
import { CardFormDialog } from '@/components/credit-cards/CardFormDialog';
import { CreditCardVisual } from '@/components/credit-cards/CreditCardVisual';
import { CategoryAnalysis } from '@/components/credit-cards/CategoryAnalysis';
import { FloatingActionButton } from '@/components/credit-cards/FloatingActionButton';
import { MobileInvoiceSummary } from '@/components/credit-cards/MobileInvoiceSummary';
import { CollapsibleCharts } from '@/components/credit-cards/CollapsibleCharts';
import { addMonths, subMonths } from 'date-fns';
import { CreditCard, InvoiceResponse } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { CheckCircle, History, CalendarRange, Plus, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CreditCardsPage() {
    const [location, setLocation] = useLocation();
    const { user } = useAuth();
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
    const [currentInvoice, setCurrentInvoice] = useState<InvoiceResponse | null>(null);
    const [invoiceYear, setInvoiceYear] = useState<number | null>(null);
    const [invoiceMonth, setInvoiceMonth] = useState<number | null>(null);
    const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);

    const [isLoadingCards, setIsLoadingCards] = useState(true);
    const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);
    const [isCardFormOpen, setIsCardFormOpen] = useState(false);
    const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

    const selectedCard = cards.find(c => c.id === selectedCardId) || null;

    // Read query parameters from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const cardIdParam = params.get('cardId');
        const yearParam = params.get('year');
        const monthParam = params.get('month');

        if (cardIdParam) {
            const cardId = parseInt(cardIdParam);
            if (!isNaN(cardId)) {
                setSelectedCardId(cardId);
            }
        }

        if (yearParam && monthParam) {
            const year = parseInt(yearParam);
            const month = parseInt(monthParam);
            if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
                setInvoiceYear(year);
                setInvoiceMonth(month);
            }
        }
    }, [location]);

    // Load Cards
    useEffect(() => {
        const loadCards = async () => {
            if (!currentOrg?.id) return;

            try {
                setIsLoadingCards(true);
                const data = await listCreditCards(currentOrg.id);
                setCards(data);

                if (data.length > 0 && !selectedCardId) {
                    const params = new URLSearchParams(window.location.search);
                    const cardIdParam = params.get('cardId');
                    if (!cardIdParam) {
                        setSelectedCardId(data[0].id);
                    }
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

    // Load Invoice
    useEffect(() => {
        const loadInvoice = async () => {
            if (!selectedCardId || !currentOrg?.id) return;

            try {
                setIsLoadingInvoice(true);
                const now = new Date();
                const year = invoiceYear || now.getFullYear();
                const month = invoiceMonth || (now.getMonth() + 1);
                
                const invoice = await getCreditCardInvoice(
                    selectedCardId,
                    year,
                    month,
                    currentOrg.id
                );
                setCurrentInvoice(invoice);
            } catch (error: any) {
                if (error?.response?.status === 404) {
                    setCurrentInvoice(null);
                } else if (error?.response?.status === 403) {
                    toast.error('Acesso negado à organização');
                    setCurrentInvoice(null);
                } else {
                    console.error('Erro ao carregar fatura:', error);
                    setCurrentInvoice(null);
                }
            } finally {
                setIsLoadingInvoice(false);
            }
        };

        loadInvoice();
    }, [selectedCardId, currentOrg?.id, invoiceYear, invoiceMonth]);

    const handleAddCard = () => {
        setCardToEdit(null);
        setIsCardFormOpen(true);
    };

    const handleEditCard = () => {
        if (selectedCard) {
            setCardToEdit(selectedCard);
            setIsCardFormOpen(true);
        }
    };

    const handleCardFormSuccess = async () => {
        if (!currentOrg?.id) return;
        const data = await listCreditCards(currentOrg.id);
        setCards(data);
        if (!selectedCardId && data.length > 0) {
            setSelectedCardId(data[0].id);
        }
    };

    const navigateToMonth = (direction: 'prev' | 'next') => {
        if (!selectedCardId) return;
        
        const now = new Date();
        const currYear = invoiceYear || now.getFullYear();
        const currMonth = invoiceMonth || (now.getMonth() + 1);
        const currentDate = new Date(currYear, currMonth - 1);
        
        const newDate = direction === 'prev' 
            ? subMonths(currentDate, 1)
            : addMonths(currentDate, 1);
        
        const newYear = newDate.getFullYear();
        const newMonth = newDate.getMonth() + 1;
        
        setLocation(`/credit-cards?cardId=${selectedCardId}&year=${newYear}&month=${newMonth}`);
        setInvoiceYear(newYear);
        setInvoiceMonth(newMonth);
    };

    const loadInvoiceForMonth = async (year: number, month: number, showLoading: boolean = true): Promise<InvoiceResponse | null> => {
        if (!selectedCardId || !currentOrg?.id) return null;
        try {
            if (showLoading) {
                setIsLoadingInvoice(true);
            }
            const invoice = await getCreditCardInvoice(
                selectedCardId,
                year,
                month,
                currentOrg.id
            );
            setCurrentInvoice(invoice);
            return invoice;
        } catch (error: any) {
            console.error('❌ Erro ao carregar fatura:', error);
            if (error?.response?.status === 404) {
                setCurrentInvoice(null);
            } else {
                setCurrentInvoice(null);
            }
            return null;
        } finally {
            if (showLoading) {
                setIsLoadingInvoice(false);
            }
        }
    };

    const handleSelectMonth = (year: number, month: number) => {
        if (!selectedCardId) return;
        setLocation(`/credit-cards?cardId=${selectedCardId}&year=${year}&month=${month}`);
        setInvoiceYear(year);
        setInvoiceMonth(month);
        setIsMonthSelectorOpen(false);
    };

    // Função auxiliar para verificar duplicação de parcelas após movimentação
    const handleInvoiceUpdated = (targetYear: number | undefined, targetMonth: number | undefined, installmentId: number | undefined) => {
        const now = new Date();
        const year = invoiceYear || now.getFullYear();
        const month = invoiceMonth || (now.getMonth() + 1);
        
        // Mostrar toast de sucesso
        if (targetYear && targetMonth && installmentId) {
            const targetDate = new Date(targetYear, targetMonth - 1);
            const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            toast.success(
                `Parcela movida para ${monthName}!`,
                {
                    duration: 5000,
                }
            );
        }
        
        // Recarregar fatura silenciosamente após delay para garantir que backend processou
        // O componente InvoiceTransactionList controla quando a animação termina
        // e só então chama esta função, então podemos recarregar imediatamente
        // Mas adicionamos um pequeno delay para garantir que a animação já começou
        setTimeout(() => {
            loadInvoiceForMonth(year, month, false);
        }, 100);
    };

    const handleSelectCard = (cardId: number) => {
        setSelectedCardId(cardId);
        setLocation(`/credit-cards?cardId=${cardId}`);
    };

    const navigateCard = (direction: 'prev' | 'next') => {
        const currentIndex = cards.findIndex(c => c.id === selectedCardId);
        if (currentIndex === -1) return;
        
        const newIndex = direction === 'prev' 
            ? (currentIndex - 1 + cards.length) % cards.length
            : (currentIndex + 1) % cards.length;
        
        handleSelectCard(cards[newIndex].id);
    };

    const handleMarkAsPaid = async () => {
        if (!selectedCardId || !currentOrg?.id || !currentYear || !currentMonth) return;
        
        setIsMarkingPaid(true);
        try {
            await markInvoicePaid(selectedCardId, currentYear, currentMonth, currentOrg.id);
            toast.success('Fatura marcada como paga!');
            // Recarregar a fatura para atualizar o status (silenciosamente)
            const invoice = await getCreditCardInvoice(selectedCardId, currentYear, currentMonth, currentOrg.id);
            setCurrentInvoice(invoice);
        } catch (error: any) {
            console.error('Error marking invoice as paid:', error);
            toast.error(error.response?.data?.detail || 'Erro ao marcar fatura como paga');
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const handleUnmarkAsPaid = async () => {
        if (!selectedCardId || !currentOrg?.id || !currentYear || !currentMonth) return;
        
        setIsMarkingPaid(true);
        try {
            await unmarkInvoicePaid(selectedCardId, currentYear, currentMonth, currentOrg.id);
            toast.success('Fatura desmarcada como paga');
            // Recarregar a fatura para atualizar o status (silenciosamente)
            const invoice = await getCreditCardInvoice(selectedCardId, currentYear, currentMonth, currentOrg.id);
            setCurrentInvoice(invoice);
        } catch (error: any) {
            console.error('Error unmarking invoice as paid:', error);
            toast.error(error.response?.data?.detail || 'Erro ao desmarcar fatura');
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const now = new Date();
    const currentYear = invoiceYear || now.getFullYear();
    const currentMonth = invoiceMonth || (now.getMonth() + 1);
    const canNavigatePrev = true;
    const canNavigateNext = currentInvoice !== null;
    const isPaid = currentInvoice?.status === 'paid';

    return (
        <PageTransition>
            <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
                {/* ========== HEADER ========== */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
                        <p className="text-sm text-muted-foreground hidden sm:block">Gerencie suas faturas e limites</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Ações de navegação - visíveis apenas em desktop */}
                        {selectedCardId && (
                            <>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setLocation('/credit-cards/history')}
                                    className="hidden sm:flex text-muted-foreground hover:text-foreground"
                                >
                                    <History className="w-4 h-4 mr-1.5" />
                                    Histórico
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setLocation('/credit-cards/planning')}
                                    className="hidden sm:flex text-muted-foreground hover:text-foreground"
                                >
                                    <CalendarRange className="w-4 h-4 mr-1.5" />
                                    Planejamento
                                </Button>
                            </>
                        )}
                        {selectedCardId && (
                            <Button variant="outline" size="icon" onClick={handleEditCard}>
                                <Settings className="w-4 h-4" />
                            </Button>
                        )}
                        <Button onClick={handleAddCard}>
                            <Plus className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Adicionar</span>
                        </Button>
                    </div>
                </div>

                {isLoadingCards ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Carregando cartões...
                    </div>
                ) : cards.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Nenhum cartão cadastrado. Adicione um cartão para começar.
                    </div>
                ) : (
                    <>
                        {/* ========== CARTÕES VISUAIS ========== */}
                        <section className="mb-6">
                            {/* Desktop/Tablet: Cartões em linha com scroll quando necessário */}
                            <div className="hidden sm:flex items-center gap-4">
                                {/* Container com scroll horizontal e indicadores */}
                                <div className="relative flex-1 min-w-0">
                                    {/* Gradiente esquerdo - indica mais cartões */}
                                    {cards.length > 3 && (
                                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                    
                                    {/* Área de scroll - padding extra para o ring de seleção */}
                                    <div className="flex items-center gap-3 overflow-x-auto py-2 px-1 scrollbar-hide scroll-smooth">
                                        {cards.map((card) => {
                                            const isSelected = card.id === selectedCardId;
                                            
                                            return (
                                                <div
                                                    key={card.id}
                                                    onClick={() => handleSelectCard(card.id)}
                                                    className={cn(
                                                        "cursor-pointer transition-all duration-200 ease-out flex-shrink-0",
                                                        isSelected 
                                                            ? "opacity-100 scale-100" 
                                                            : "opacity-50 scale-95 hover:opacity-75 hover:scale-[0.97]"
                                                    )}
                                                >
                                                    <CreditCardVisual
                                                        card={card}
                                                        isSelected={isSelected}
                                                        size="sm"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Gradiente direito - indica mais cartões */}
                                    {cards.length > 3 && (
                                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                                    )}
                                </div>

                                {/* Contador quando há muitos cartões */}
                                {cards.length > 4 && (
                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                        {cards.findIndex(c => c.id === selectedCardId) + 1}/{cards.length}
                                    </div>
                                )}
                            </div>

                            {/* Mobile: Scroll horizontal com indicadores */}
                            <div className="sm:hidden">
                                <div className="relative">
                                    {/* Área de scroll - padding extra para o ring de seleção */}
                                    <div className="flex items-center gap-2 overflow-x-auto py-2 -mx-4 px-4 scrollbar-hide scroll-smooth">
                                        {cards.map((card) => {
                                            const isSelected = card.id === selectedCardId;
                                            
                                            return (
                                                <div
                                                    key={card.id}
                                                    onClick={() => handleSelectCard(card.id)}
                                                    className={cn(
                                                        "cursor-pointer transition-all duration-200 ease-out flex-shrink-0",
                                                        isSelected 
                                                            ? "opacity-100 scale-100" 
                                                            : "opacity-50 scale-95"
                                                    )}
                                                >
                                                    <CreditCardVisual
                                                        card={card}
                                                        isSelected={isSelected}
                                                        size="xs"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Gradiente direito - mobile */}
                                    {cards.length > 2 && (
                                        <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                                    )}
                                </div>
                                
                                {/* Indicador de posição - mobile */}
                                {cards.length > 2 && (
                                    <div className="flex justify-center gap-1 mt-2">
                                        {cards.map((card) => (
                                            <button
                                                key={card.id}
                                                onClick={() => handleSelectCard(card.id)}
                                                className={cn(
                                                    "h-1 rounded-full transition-all duration-200",
                                                    card.id === selectedCardId 
                                                        ? "bg-primary w-3" 
                                                        : "bg-gray-300 dark:bg-gray-600 w-1"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ========== DESKTOP: Fatura + Análise + Transações ========== */}
                        <div className="hidden lg:block space-y-6">
                            {/* Row: Status Card + Category Analysis */}
                            <div className="grid grid-cols-2 gap-6">
                                <InvoiceStatusCard
                                    invoice={currentInvoice}
                                    card={selectedCard}
                                    isLoading={isLoadingInvoice}
                                    isMarkingPaid={isMarkingPaid}
                                    onNavigateMonth={navigateToMonth}
                                    onSelectMonth={handleSelectMonth}
                                    canNavigatePrev={canNavigatePrev}
                                    canNavigateNext={canNavigateNext}
                                    currentYear={currentYear}
                                    currentMonth={currentMonth}
                                    onMarkAsPaid={handleMarkAsPaid}
                                    onUnmarkAsPaid={handleUnmarkAsPaid}
                                    isPaid={isPaid}
                                />
                                <CategoryAnalysis
                                    currentInvoice={currentInvoice}
                                    previousMonthTotal={currentInvoice?.previous_month_total}
                                    monthOverMonthChange={currentInvoice?.month_over_month_change}
                                    isLoading={isLoadingInvoice}
                                />
                            </div>

                            {/* Transações */}
                            <InvoiceTransactionList
                                transactions={currentInvoice?.items || []}
                                isLoading={isLoadingInvoice}
                                grouped
                                cardId={selectedCardId || undefined}
                                organizationId={currentOrg?.id}
                                currentInvoice={currentInvoice}
                                currentYear={invoiceYear || new Date().getFullYear()}
                                currentMonth={invoiceMonth || new Date().getMonth() + 1}
                                onInvoiceUpdated={handleInvoiceUpdated}
                            />
                        </div>

                        {/* ========== TABLET: Layout empilhado ========== */}
                        <div className="hidden md:block lg:hidden space-y-4">
                            <InvoiceStatusCard
                                invoice={currentInvoice}
                                card={selectedCard}
                                isLoading={isLoadingInvoice}
                                isMarkingPaid={isMarkingPaid}
                                onNavigateMonth={navigateToMonth}
                                onSelectMonth={handleSelectMonth}
                                canNavigatePrev={canNavigatePrev}
                                canNavigateNext={canNavigateNext}
                                currentYear={currentYear}
                                currentMonth={currentMonth}
                                onMarkAsPaid={handleMarkAsPaid}
                                onUnmarkAsPaid={handleUnmarkAsPaid}
                                isPaid={isPaid}
                            />
                            <CategoryAnalysis
                                currentInvoice={currentInvoice}
                                previousMonthTotal={currentInvoice?.previous_month_total}
                                monthOverMonthChange={currentInvoice?.month_over_month_change}
                                isLoading={isLoadingInvoice}
                            />
                            <InvoiceTransactionList
                                transactions={currentInvoice?.items || []}
                                isLoading={isLoadingInvoice}
                                grouped
                                compactCards
                                cardId={selectedCardId || undefined}
                                organizationId={currentOrg?.id}
                                currentInvoice={currentInvoice}
                                currentYear={invoiceYear || new Date().getFullYear()}
                                currentMonth={invoiceMonth || new Date().getMonth() + 1}
                                onInvoiceUpdated={handleInvoiceUpdated}
                            />
                        </div>

                        {/* ========== MOBILE: Layout compacto ========== */}
                        <div className="md:hidden space-y-3">
                            <MobileInvoiceSummary
                                invoice={currentInvoice}
                                isLoading={isLoadingInvoice}
                                currentYear={currentYear}
                                currentMonth={currentMonth}
                                onNavigateMonth={navigateToMonth}
                                canNavigatePrev={canNavigatePrev}
                                canNavigateNext={canNavigateNext}
                            />
                            <CollapsibleCharts
                                currentInvoice={currentInvoice}
                                isLoading={isLoadingInvoice}
                            />
                            <InvoiceTransactionList
                                transactions={currentInvoice?.items || []}
                                isLoading={isLoadingInvoice}
                                grouped
                                mobileOptimized
                                compactCards
                                cardId={selectedCardId || undefined}
                                organizationId={currentOrg?.id}
                                currentInvoice={currentInvoice}
                                currentYear={invoiceYear || new Date().getFullYear()}
                                currentMonth={invoiceMonth || new Date().getMonth() + 1}
                                onInvoiceUpdated={handleInvoiceUpdated}
                            />
                        </div>

                        {/* Mobile FAB */}
                        <FloatingActionButton
                            actions={[
                                { 
                                    icon: CheckCircle, 
                                    label: isPaid ? 'Paga' : 'Marcar Paga', 
                                    onClick: handleMarkAsPaid,
                                    variant: isPaid ? 'success' : 'default'
                                },
                                { 
                                    icon: History, 
                                    label: 'Histórico', 
                                    onClick: () => setLocation('/credit-cards/history')
                                },
                                { 
                                    icon: CalendarRange, 
                                    label: 'Planejamento', 
                                    onClick: () => setLocation('/credit-cards/planning')
                                },
                            ]}
                        />
                    </>
                )}
            </div>

            {/* Dialogs */}
            <CardFormDialog
                open={isCardFormOpen}
                onOpenChange={setIsCardFormOpen}
                cardToEdit={cardToEdit}
                onSuccess={handleCardFormSuccess}
            />

            {selectedCardId && (
                <InvoiceMonthSelector
                    open={isMonthSelectorOpen}
                    onOpenChange={setIsMonthSelectorOpen}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    onSelect={handleSelectMonth}
                />
            )}
        </PageTransition>
    );
}
