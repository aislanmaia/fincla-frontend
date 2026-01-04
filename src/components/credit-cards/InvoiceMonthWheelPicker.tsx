import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface InvoiceMonthWheelPickerProps {
    currentYear: number;
    currentMonth: number;
    onSelect: (year: number, month: number) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const InvoiceMonthWheelPicker: React.FC<InvoiceMonthWheelPickerProps> = ({
    currentYear,
    currentMonth,
    onSelect,
    isOpen,
    onToggle,
}) => {
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const yearScrollRef = useRef<HTMLDivElement>(null);
    const monthScrollRef = useRef<HTMLDivElement>(null);

    // Generate year options (current year ± 2 years)
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYearNum - 2 + i);

    // Month options
    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

    // Update selected values when currentYear/currentMonth change
    useEffect(() => {
        if (isOpen) {
            setSelectedYear(currentYear);
            setSelectedMonth(currentMonth);
            // Scroll to selected values after a brief delay
            setTimeout(() => {
                scrollToSelected(yearScrollRef.current, currentYear);
                scrollToSelected(monthScrollRef.current, currentMonth);
            }, 100);
        }
    }, [currentYear, currentMonth, isOpen]);

    const scrollToSelected = (container: HTMLDivElement | null, value: number) => {
        if (!container) return;
        const item = container.querySelector(`[data-value="${value}"]`) as HTMLElement;
        if (item) {
            const containerRect = container.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const scrollTop = container.scrollTop + (itemRect.top - containerRect.top) - (containerRect.height / 2) + (itemRect.height / 2);
            container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        }
    };

    const handleYearSelect = (year: number) => {
        setSelectedYear(year);
        onSelect(year, selectedMonth);
    };

    const handleMonthSelect = (month: number) => {
        setSelectedMonth(month);
        onSelect(selectedYear, month);
    };

    if (!isOpen) return null;

    return (
        <div className="mt-3 border-t pt-3">
            <div className="relative flex gap-3">
                {/* Year Wheel */}
                <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-2 px-2 text-center">Ano</div>
                    <div className="relative h-36 overflow-hidden rounded-lg border bg-background">
                        {/* Selection indicator overlay - iOS style */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 border-y border-border pointer-events-none z-10 bg-muted/30" />
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 pointer-events-none z-20">
                            <div className="h-full flex items-center justify-center">
                                <div className="w-full h-0.5 bg-primary/20" />
                            </div>
                        </div>
                        
                        <div
                            ref={yearScrollRef}
                            className="h-full overflow-y-auto scroll-smooth"
                            style={{
                                scrollSnapType: 'y mandatory',
                                WebkitOverflowScrolling: 'touch',
                            }}
                        >
                            <div className="py-[72px] space-y-0">
                                {yearOptions.map((year) => {
                                    const isSelected = year === selectedYear;
                                    return (
                                        <button
                                            key={year}
                                            data-value={year}
                                            type="button"
                                            onClick={() => handleYearSelect(year)}
                                            className={cn(
                                                "w-full py-2.5 px-3 text-center transition-all",
                                                "hover:bg-muted/30 active:bg-muted/50",
                                                isSelected
                                                    ? "text-base font-semibold text-foreground scale-105"
                                                    : "text-sm text-muted-foreground"
                                            )}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {year}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Month Wheel */}
                <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-2 px-2 text-center">Mês</div>
                    <div className="relative h-36 overflow-hidden rounded-lg border bg-background">
                        {/* Selection indicator overlay - iOS style */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 border-y border-border pointer-events-none z-10 bg-muted/30" />
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-9 pointer-events-none z-20">
                            <div className="h-full flex items-center justify-center">
                                <div className="w-full h-0.5 bg-primary/20" />
                            </div>
                        </div>
                        
                        <div
                            ref={monthScrollRef}
                            className="h-full overflow-y-auto scroll-smooth"
                            style={{
                                scrollSnapType: 'y mandatory',
                                WebkitOverflowScrolling: 'touch',
                            }}
                        >
                            <div className="py-[72px] space-y-0">
                                {monthOptions.map((month) => {
                                    const isSelected = month === selectedMonth;
                                    const monthName = format(new Date(selectedYear, month - 1), 'MMMM', { locale: ptBR });
                                    return (
                                        <button
                                            key={month}
                                            data-value={month}
                                            type="button"
                                            onClick={() => handleMonthSelect(month)}
                                            className={cn(
                                                "w-full py-2.5 px-3 text-center transition-all capitalize",
                                                "hover:bg-muted/30 active:bg-muted/50",
                                                isSelected
                                                    ? "text-base font-semibold text-foreground scale-105"
                                                    : "text-sm text-muted-foreground"
                                            )}
                                            style={{ scrollSnapAlign: 'center' }}
                                        >
                                            {monthName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

