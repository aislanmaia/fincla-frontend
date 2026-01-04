import React from 'react';
import { Button } from '@/components/ui/button';
import { History, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsBarProps {
    onNavigateHistory?: () => void;
    onNavigatePlanning?: () => void;
    className?: string;
    compact?: boolean;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
    onNavigateHistory,
    onNavigatePlanning,
    className,
    compact = false,
}) => {
    return (
        <div className={cn("flex items-center gap-1", className)}>
            {onNavigateHistory && (
                <Button
                    size={compact ? "sm" : "default"}
                    variant="ghost"
                    onClick={onNavigateHistory}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <History className="w-4 h-4 mr-1.5" />
                    {!compact && "Histórico"}
                </Button>
            )}
            
            {onNavigatePlanning && (
                <Button
                    size={compact ? "sm" : "default"}
                    variant="ghost"
                    onClick={onNavigatePlanning}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <CalendarRange className="w-4 h-4 mr-1.5" />
                    {!compact && "Planejamento"}
                </Button>
            )}
        </div>
    );
};

