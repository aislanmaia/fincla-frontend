import React from 'react';
import { CreditCard } from '@/types/api';
import { cn } from '@/lib/utils';
import { CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

interface CreditCardSelectorProps {
    cards: CreditCard[];
    selectedCardId: number | null;
    onSelectCard: (cardId: number) => void;
    onAddCard: () => void;
}

export const CreditCardSelector: React.FC<CreditCardSelectorProps> = ({
    cards,
    selectedCardId,
    onSelectCard,
    onAddCard,
}) => {
    return (
        <div className="w-full flex items-center gap-2 sm:gap-4">
            <Carousel
                opts={{
                    align: "start",
                    dragFree: true,
                }}
                className="w-full"
            >
                <CarouselContent className="-ml-1 sm:-ml-2 md:-ml-4">
                    {cards.map((card) => (
                        <CarouselItem key={card.id} className="pl-1 sm:pl-2 md:pl-4 basis-[85%] sm:basis-[60%] md:basis-auto">
                            <div
                                onClick={() => onSelectCard(card.id)}
                                className={cn(
                                    "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg border transition-all cursor-pointer",
                                    selectedCardId === card.id
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border hover:border-primary/50 hover:bg-accent"
                                )}
                            >
                                <div className={cn(
                                    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                    selectedCardId === card.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                )}>
                                    <CreditCardIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs sm:text-sm font-medium leading-none truncate">
                                        {card.description || 'Cartão sem nome'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-1">
                                        •••• {card.last4}
                                    </span>
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                    <CarouselItem className="pl-2 md:pl-4 basis-auto">
                        <Button
                            variant="outline"
                            className="h-[50px] w-[50px] rounded-lg border-dashed flex items-center justify-center p-0"
                            onClick={onAddCard}
                        >
                            <Plus className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </CarouselItem>
                </CarouselContent>
                <div className="hidden md:block">
                    <CarouselPrevious className="-left-12" />
                    <CarouselNext className="-right-12" />
                </div>
            </Carousel>
        </div>
    );
};
