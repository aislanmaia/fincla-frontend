import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABAction {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'success' | 'destructive';
}

interface FloatingActionButtonProps {
    actions: FABAction[];
    className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    actions,
    className,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleActionClick = (action: FABAction) => {
        action.onClick();
        setIsOpen(false);
    };

    const getVariantClasses = (variant?: string) => {
        switch (variant) {
            case 'success':
                return 'bg-green-600 hover:bg-green-700 text-white';
            case 'destructive':
                return 'bg-red-600 hover:bg-red-700 text-white';
            default:
                return 'bg-card hover:bg-accent text-card-foreground';
        }
    };

    return (
        <div className={cn("fixed bottom-6 right-6 z-50 md:hidden", className)}>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 -z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}
            
            {/* Action buttons */}
            <div className={cn(
                "absolute bottom-16 right-0 space-y-2 transition-all duration-200",
                isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
            )}>
                {actions.map((action, index) => (
                    <button
                        key={action.label}
                        onClick={() => handleActionClick(action)}
                        className={cn(
                            "flex items-center gap-3 shadow-lg rounded-full px-4 py-2.5 transition-all duration-200 whitespace-nowrap",
                            getVariantClasses(action.variant)
                        )}
                        style={{
                            transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
                            transform: isOpen ? 'translateX(0)' : 'translateX(20px)',
                        }}
                    >
                        <action.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{action.label}</span>
                    </button>
                ))}
            </div>
            
            {/* Main FAB button */}
            <Button 
                size="icon" 
                className={cn(
                    "w-14 h-14 rounded-full shadow-lg transition-transform duration-200",
                    isOpen && "rotate-45"
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? (
                    <X className="w-6 h-6" />
                ) : (
                    <Plus className="w-6 h-6" />
                )}
            </Button>
        </div>
    );
};

