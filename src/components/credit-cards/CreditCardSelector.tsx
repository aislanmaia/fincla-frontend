import React from 'react';
import { CreditCard } from '@/types/api';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus, CreditCard as CreditCardIcon, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CreditCardSelectorProps {
    cards: CreditCard[];
    selectedCardId: number | null;
    onSelectCard: (cardId: number) => void;
    onAddCard: () => void;
    onEditCard: (card: CreditCard) => void;
    onDeleteCard: (cardId: number) => void;
}

export const CreditCardSelector: React.FC<CreditCardSelectorProps> = ({
    cards,
    selectedCardId,
    onSelectCard,
    onAddCard,
    onEditCard,
    onDeleteCard,
}) => {
    return (
        <div className="flex items-center space-x-4 overflow-x-auto pb-4 scrollbar-hide">
            {cards.map((card) => (
                <Card
                    key={card.id}
                    className={cn(
                        "min-w-[280px] p-4 cursor-pointer transition-all duration-200 border-2 relative group",
                        selectedCardId === card.id
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                    )}
                    onClick={() => onSelectCard(card.id)}
                >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditCard(card); }}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteCard(card.id); }} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center",
                                selectedCardId === card.id ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            )}>
                                <CreditCardIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">{card.description || 'Cartão sem nome'}</h3>
                                <p className="text-xs text-muted-foreground">{card.brand}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="text-lg font-mono tracking-wider">
                            •••• {card.last4}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Vence dia {card.due_day}
                        </div>
                    </div>
                </Card>
            ))}

            <Button
                variant="outline"
                className="min-w-[60px] h-[100px] flex flex-col items-center justify-center gap-2 border-dashed"
                onClick={onAddCard}
            >
                <Plus className="w-6 h-6" />
                <span className="text-xs">Novo</span>
            </Button>
        </div>
    );
};
