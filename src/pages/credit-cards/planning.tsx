import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { PageTransition } from '@/components/PageTransition';
import { Breadcrumb } from '@/components/Breadcrumb';
import { FinancialImpactSimulator } from '@/components/credit-cards/FinancialImpactSimulator';
import { listCreditCards, getCreditCardInvoice } from '@/api/creditCards';
import { CreditCard, InvoiceResponse } from '@/types/api';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard as CreditCardIcon, Sparkles, Calendar, TrendingUp, Receipt, Package, ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MonthlyCommitment {
  month: string;
  year: number;
  monthNumber: number;
  totalAmount: number;
  installmentsCount: number;
  mainInstallments: Array<{ description: string; amount: number }>;
}

export default function FuturePlanningPage() {
    const [, setLocation] = useLocation();
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [monthlyCommitments, setMonthlyCommitments] = useState<MonthlyCommitment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    
    // Carousel state
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    // Update carousel state when it changes
    const onCarouselSelect = useCallback(() => {
        if (!carouselApi) return;
        setCurrentSlide(carouselApi.selectedScrollSnap());
        setCanScrollPrev(carouselApi.canScrollPrev());
        setCanScrollNext(carouselApi.canScrollNext());
    }, [carouselApi]);

    useEffect(() => {
        if (!carouselApi) return;
        
        onCarouselSelect();
        carouselApi.on('select', onCarouselSelect);
        carouselApi.on('reInit', onCarouselSelect);
        
        return () => {
            carouselApi.off('select', onCarouselSelect);
            carouselApi.off('reInit', onCarouselSelect);
        };
    }, [carouselApi, onCarouselSelect]);

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

    // Load Future Commitments
    useEffect(() => {
        const loadFutureCommitments = async () => {
            if (!selectedCardId || !currentOrg?.id) return;

            try {
                setIsLoading(true);
                const commitments: MonthlyCommitment[] = [];

                // Load next 6 months
                for (let i = 1; i <= 6; i++) {
                    const date = addMonths(new Date(), i);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    
                    try {
                        const invoice = await getCreditCardInvoice(
                            Number(selectedCardId),
                            year,
                            month,
                            currentOrg.id
                        );

                        // If we get here, invoice exists (200 response means invoice exists with items)
                        // Extract installment transactions
                        const installments = invoice.items
                            .filter(item => item.installment_number && item.installment_number > 0)
                            .map(item => ({
                                description: item.description || 'Parcela',
                                amount: item.amount,
                            }))
                            .slice(0, 3); // Top 3 installments

                        commitments.push({
                            month: format(date, 'MMMM', { locale: ptBR }),
                            year,
                            monthNumber: month,
                            totalAmount: invoice.total_amount,
                            installmentsCount: invoice.items.filter(item => item.installment_number).length,
                            mainInstallments: installments,
                        });
                    } catch (err: any) {
                        // 404 means invoice doesn't exist for this month/card - add empty commitment
                        if (err?.response?.status === 404) {
                            commitments.push({
                                month: format(date, 'MMMM', { locale: ptBR }),
                                year,
                                monthNumber: month,
                                totalAmount: 0,
                                installmentsCount: 0,
                                mainInstallments: [],
                            });
                        }
                    }
                }

                setMonthlyCommitments(commitments);
            } catch (error) {
                console.error('Failed to load future commitments:', error);
                toast.error('Erro ao carregar compromissos futuros');
            } finally {
                setIsLoading(false);
            }
        };

        loadFutureCommitments();
    }, [selectedCardId, currentOrg?.id]);

    return (
        <PageTransition>
            <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6 sm:space-y-8">
                {/* Breadcrumb */}
                <Breadcrumb
                    items={[
                        { label: 'Cartões', href: '/credit-cards', icon: <CreditCardIcon className="w-4 h-4" /> },
                        { label: 'Planejamento Futuro' },
                    ]}
                />

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Planejamento Futuro</h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-1">
                            Visualize seus compromissos futuros e simule o impacto de novas compras
                        </p>
                    </div>
                    
                    {/* Main Action Button */}
                    <Button
                        size="lg"
                        onClick={() => setIsSimulatorOpen(true)}
                        className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
                    >
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        <span className="text-sm sm:text-base">Simular Nova Compra</span>
                    </Button>
                </div>

                {/* Card Selector */}
                <Card className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <CreditCardIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                <SelectTrigger className="w-full">
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
                    </div>
                </Card>

                {/* Commitments Visualization Section */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                        <h2 className="text-lg sm:text-xl font-semibold">Compromissos Atuais</h2>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Visualize o total previsto e as principais parcelas para os próximos meses. 
                        Esta informação serve como contexto para suas simulações.
                    </p>

                    {isLoading ? (
                        <Card className="p-8">
                            <div className="text-center text-muted-foreground">
                                Carregando compromissos futuros...
                            </div>
                        </Card>
                    ) : monthlyCommitments.length === 0 ? (
                        <Card className="p-8">
                            <div className="text-center text-muted-foreground">
                                Nenhum compromisso futuro encontrado.
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {/* Carousel Container with visual indicators */}
                            <div className="relative group">
                                {/* Left gradient indicator */}
                                <div 
                                    className={cn(
                                        "absolute left-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none transition-opacity duration-300",
                                        canScrollPrev ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                
                                {/* Right gradient indicator */}
                                <div 
                                    className={cn(
                                        "absolute right-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none transition-opacity duration-300",
                                        canScrollNext ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                
                                {/* Navigation buttons - more visible */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className={cn(
                                        "absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/95 backdrop-blur shadow-lg border-2 transition-all duration-200",
                                        "hover:bg-primary hover:text-primary-foreground hover:scale-110",
                                        canScrollPrev 
                                            ? "opacity-100" 
                                            : "opacity-0 pointer-events-none"
                                    )}
                                    onClick={() => carouselApi?.scrollPrev()}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/95 backdrop-blur shadow-lg border-2 transition-all duration-200",
                                        "hover:bg-primary hover:text-primary-foreground hover:scale-110",
                                        canScrollNext 
                                            ? "opacity-100" 
                                            : "opacity-0 pointer-events-none"
                                    )}
                                    onClick={() => carouselApi?.scrollNext()}
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                                
                                <Carousel
                                    setApi={setCarouselApi}
                                    opts={{
                                        align: 'start',
                                        loop: false,
                                    }}
                                    className="w-full"
                                >
                                    <CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
                                        {monthlyCommitments.map((commitment, index) => {
                                            const isCurrentMonth = index === 0;
                                            
                                            return (
                                                <CarouselItem 
                                                    key={`${commitment.year}-${commitment.monthNumber}`} 
                                                    className="pl-2 sm:pl-3 md:pl-4 basis-[85%] sm:basis-[60%] md:basis-1/2 lg:basis-1/3 cursor-grab active:cursor-grabbing"
                                                >
                                                    <Card className={cn(
                                                        'p-4 sm:p-5 md:p-6 h-full transition-all hover:shadow-lg hover:-translate-y-1',
                                                        isCurrentMonth && 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 ring-2 ring-indigo-200 dark:ring-indigo-800'
                                                    )}>
                                                        <div className="space-y-3 sm:space-y-4">
                                                            {/* Header */}
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <h3 className="font-bold text-base sm:text-lg capitalize truncate">
                                                                        {commitment.month}
                                                                    </h3>
                                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                                        {commitment.year}
                                                                    </p>
                                                                </div>
                                                                {isCurrentMonth && (
                                                                    <span className="text-[10px] sm:text-xs bg-indigo-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap flex-shrink-0 animate-pulse">
                                                                        Próximo
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Total Amount */}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                                                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                    <span>Total Previsto</span>
                                                                </div>
                                                                <div className="text-xl sm:text-2xl font-bold">
                                                                    R$ {commitment.totalAmount.toFixed(2)}
                                                                </div>
                                                            </div>

                                                            {/* Installments Summary */}
                                                            {commitment.installmentsCount > 0 ? (
                                                                <div className="space-y-1.5 sm:space-y-2 pt-2 border-t">
                                                                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                                                        <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span>{commitment.installmentsCount} parcela(s)</span>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-0.5 sm:space-y-1">
                                                                        {commitment.mainInstallments.map((inst, idx) => (
                                                                            <div key={idx} className="flex justify-between gap-2 text-xs sm:text-sm">
                                                                                <span className="text-muted-foreground truncate">
                                                                                    {inst.description}
                                                                                </span>
                                                                                <span className="font-medium whitespace-nowrap flex-shrink-0">
                                                                                    R$ {inst.amount.toFixed(2)}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {commitment.installmentsCount > 3 && (
                                                                            <div className="text-[10px] sm:text-xs text-muted-foreground">
                                                                                + {commitment.installmentsCount - 3} outras
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="pt-2 border-t">
                                                                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                                                                        <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                                                        <span>Sem parcelas previstas</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Card>
                                                </CarouselItem>
                                            );
                                        })}
                                    </CarouselContent>
                                </Carousel>
                            </div>
                            
                            {/* Pagination indicators and drag hint */}
                            <div className="flex flex-col items-center gap-2">
                                {/* Dots pagination */}
                                <div className="flex items-center gap-1.5">
                                    {monthlyCommitments.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => carouselApi?.scrollTo(index)}
                                            className={cn(
                                                "h-2 rounded-full transition-all duration-300",
                                                currentSlide === index 
                                                    ? "w-6 bg-primary" 
                                                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                            )}
                                            aria-label={`Ir para ${monthlyCommitments[index].month}`}
                                        />
                                    ))}
                                </div>
                                
                                {/* Counter and drag hint */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="font-medium">
                                        {currentSlide + 1} de {monthlyCommitments.length}
                                    </span>
                                    <span className="hidden sm:flex items-center gap-1 opacity-60">
                                        <GripHorizontal className="w-3.5 h-3.5" />
                                        Arraste para navegar
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="p-2 sm:p-2.5 md:p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex-shrink-0">
                            <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">
                                Simulador de Impacto Financeiro
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                Use o simulador para avaliar o impacto de uma nova compra parcelada no seu orçamento. 
                                O sistema analisará suas receitas previstas, despesas atuais e metas de economia para 
                                fornecer uma recomendação clara sobre a viabilidade da compra.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Financial Impact Simulator Modal */}
            <FinancialImpactSimulator
                open={isSimulatorOpen}
                onOpenChange={setIsSimulatorOpen}
            />
        </PageTransition>
    );
}
