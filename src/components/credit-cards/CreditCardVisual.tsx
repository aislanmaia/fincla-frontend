import React from 'react';
import { CreditCard as CreditCardType } from '@/types/api';
import { cn } from '@/lib/utils';

interface CreditCardVisualProps {
    card: CreditCardType | null;
    isSelected?: boolean;
    onClick?: () => void;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
    /** Usado para efeito de carrossel - cartão aparece parcialmente */
    isPreview?: boolean;
}

// Cores padrão por bandeira (quando backend fornecer o campo brand)
const brandColors: Record<string, { from: string; to: string; accent: string }> = {
    visa: { from: '#1a1f71', to: '#0d47a1', accent: '#ffc107' },
    mastercard: { from: '#eb001b', to: '#f79e1b', accent: '#ffffff' },
    elo: { from: '#00a4e0', to: '#ffcb05', accent: '#000000' },
    amex: { from: '#006fcf', to: '#00175a', accent: '#ffffff' },
    hipercard: { from: '#822124', to: '#b71c1c', accent: '#ffffff' },
    nubank: { from: '#8B5CF6', to: '#6D28D9', accent: '#ffffff' },
    inter: { from: '#ff7a00', to: '#ff5500', accent: '#ffffff' },
    c6: { from: '#1a1a1a', to: '#2d2d2d', accent: '#c4a000' },
    other: { from: '#374151', to: '#1f2937', accent: '#9ca3af' },
};

// Detectar "marca" pelo nome/descrição do cartão ou usar brand se disponível
const detectBrandFromCard = (card: CreditCardType): string => {
    // Se tem brand definido, usar direto
    if (card.brand && brandColors[card.brand.toLowerCase()]) {
        return card.brand.toLowerCase();
    }
    
    // Tentar detectar pela descrição
    const description = card.description?.toLowerCase() || '';
    if (description.includes('nubank') || description.includes('nu ')) return 'nubank';
    if (description.includes('inter')) return 'inter';
    if (description.includes('c6')) return 'c6';
    if (description.includes('itau') || description.includes('itaú')) return 'other';
    if (description.includes('bradesco')) return 'other';
    if (description.includes('santander')) return 'other';
    
    // Se tem brand mas não está no mapa de cores
    if (card.brand) {
        return card.brand.toLowerCase();
    }
    
    return 'other';
};

// Logos das bandeiras (SVG inline simplificado)
const BrandLogo: React.FC<{ brand: string; className?: string }> = ({ brand, className }) => {
    switch (brand) {
        case 'visa':
            return (
                <span className={cn("font-bold italic text-white tracking-tight", className)}>
                    VISA
                </span>
            );
        case 'mastercard':
            return (
                <div className={cn("flex items-center gap-0", className)}>
                    <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
                    <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-90 -ml-2" />
                </div>
            );
        case 'elo':
            return (
                <span className={cn("font-bold text-black", className)}>
                    elo
                </span>
            );
        case 'amex':
            return (
                <span className={cn("font-bold text-white text-xs tracking-tight", className)}>
                    AMEX
                </span>
            );
        case 'hipercard':
            return (
                <span className={cn("font-bold text-white text-xs", className)}>
                    HIPER
                </span>
            );
        default:
            return null;
    }
};

export const CreditCardVisual: React.FC<CreditCardVisualProps> = ({
    card,
    isSelected = false,
    onClick,
    size = 'md',
    className,
    isPreview = false,
}) => {
    if (!card) {
        return (
            <div className={cn(
                "rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse",
                size === 'xs' && "w-36 h-22",
                size === 'sm' && "w-44 h-28",
                size === 'md' && "w-52 h-32",
                size === 'lg' && "w-64 h-40",
                className
            )} />
        );
    }

    const detectedBrand = detectBrandFromCard(card);
    const colors = brandColors[detectedBrand] || brandColors.other;
    const cardName = card.description || `Cartão ${card.last4}`;

    const sizeClasses = {
        xs: "w-36 h-22 p-2 text-[10px]",
        sm: "w-44 h-28 p-2.5 text-xs",
        md: "w-52 h-32 p-3 text-xs",
        lg: "w-64 h-40 p-4 text-sm",
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative rounded-xl overflow-hidden transition-all duration-300 select-none flex-shrink-0",
                sizeClasses[size],
                onClick && "cursor-pointer hover:scale-[1.02] hover:shadow-xl",
                isSelected && !isPreview && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
                isPreview && "opacity-60 scale-95",
                className
            )}
            style={{
                background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
            }}
        >
            {/* Padrão decorativo */}
            <div className="absolute inset-0 opacity-10">
                <div className={cn(
                    "absolute top-0 right-0 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/2",
                    size === 'xs' && "w-16 h-16",
                    size === 'sm' && "w-20 h-20",
                    size === 'md' && "w-24 h-24",
                    size === 'lg' && "w-32 h-32"
                )} />
                <div className={cn(
                    "absolute bottom-0 left-0 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2",
                    size === 'xs' && "w-12 h-12",
                    size === 'sm' && "w-16 h-16",
                    size === 'md' && "w-20 h-20",
                    size === 'lg' && "w-24 h-24"
                )} />
            </div>

            {/* Conteúdo do cartão */}
            <div className="relative h-full flex flex-col justify-between text-white">
                {/* Header: Nome do banco + Bandeira */}
                <div className="flex items-start justify-between">
                    <span className={cn(
                        "font-bold uppercase tracking-wider truncate max-w-[70%]",
                        size === 'xs' && "text-[9px]",
                        size === 'sm' && "text-[10px]",
                        size === 'md' && "text-xs",
                        size === 'lg' && "text-sm"
                    )}>
                        {cardName}
                    </span>
                    <BrandLogo brand={card.brand?.toLowerCase() || 'mastercard'} className={cn(
                        size === 'xs' && "scale-50",
                        size === 'sm' && "scale-75",
                        size === 'md' && "scale-90"
                    )} />
                </div>

                {/* Chip (visual) - hidden on xs */}
                {size !== 'xs' && (
                    <div className={cn(
                        "rounded bg-gradient-to-br from-yellow-300 to-yellow-500",
                        size === 'sm' && "w-5 h-3.5",
                        size === 'md' && "w-6 h-4",
                        size === 'lg' && "w-8 h-6"
                    )}>
                        <div className="w-full h-full grid grid-cols-2 gap-px p-0.5">
                            <div className="bg-yellow-600/30 rounded-sm" />
                            <div className="bg-yellow-600/30 rounded-sm" />
                            <div className="bg-yellow-600/30 rounded-sm" />
                            <div className="bg-yellow-600/30 rounded-sm" />
                        </div>
                    </div>
                )}

                {/* Número do cartão */}
                <div className={cn(
                    "font-mono tracking-wider",
                    size === 'xs' && "text-[10px]",
                    size === 'sm' && "text-xs",
                    size === 'md' && "text-sm",
                    size === 'lg' && "text-base"
                )}>
                    •••• {card.last4}
                </div>

                {/* Footer: Vencimento - simplified on xs/sm */}
                <div className="flex items-end justify-between">
                    <div className={cn(size === 'xs' && "hidden")}>
                        <div className={cn(
                            "text-white/60 uppercase",
                            size === 'sm' && "text-[7px]",
                            size === 'md' && "text-[8px]",
                            size === 'lg' && "text-[10px]"
                        )}>
                            Vence
                        </div>
                        <div className={cn(
                            "font-medium",
                            size === 'sm' && "text-[9px]",
                            size === 'md' && "text-[10px]",
                            size === 'lg' && "text-xs"
                        )}>
                            Dia {card.due_day}
                        </div>
                    </div>
                    {/* Show due day inline on xs */}
                    {size === 'xs' && (
                        <span className="text-[8px] text-white/70">Dia {card.due_day}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

