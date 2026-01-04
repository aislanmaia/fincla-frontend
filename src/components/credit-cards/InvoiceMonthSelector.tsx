import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subMonths, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from 'lucide-react';

interface InvoiceMonthSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentYear: number;
    currentMonth: number;
    onSelect: (year: number, month: number) => void;
}

export const InvoiceMonthSelector: React.FC<InvoiceMonthSelectorProps> = ({
    open,
    onOpenChange,
    currentYear,
    currentMonth,
    onSelect,
}) => {
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // Generate year options (current year ± 2 years)
    const currentDate = new Date();
    const currentYearNum = currentDate.getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYearNum - 2 + i);

    // Month options
    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

    const handleConfirm = () => {
        onSelect(selectedYear, selectedMonth);
        onOpenChange(false);
    };

    const handleQuickSelect = (monthsOffset: number) => {
        let targetDate: Date;
        
        if (monthsOffset === 0) {
            // "Mês Atual" - usar o mês atual real (hoje)
            targetDate = new Date();
        } else {
            // "Mês Anterior" ou "Próximo Mês" - calcular a partir do mês visualizado
            targetDate = addMonths(new Date(currentYear, currentMonth - 1), monthsOffset);
        }
        
        setSelectedYear(targetDate.getFullYear());
        setSelectedMonth(targetDate.getMonth() + 1);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Selecionar Fatura
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Quick Navigation */}
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickSelect(-1)}
                            className="text-xs"
                        >
                            Mês Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickSelect(0)}
                            className="text-xs"
                        >
                            Mês Atual
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickSelect(1)}
                            className="text-xs"
                        >
                            Próximo Mês
                        </Button>
                    </div>

                    {/* Year and Month Selectors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ano</label>
                            <Select
                                value={String(selectedYear)}
                                onValueChange={(value) => setSelectedYear(parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearOptions.map((year) => (
                                        <SelectItem key={year} value={String(year)}>
                                            {year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mês</label>
                            <Select
                                value={String(selectedMonth)}
                                onValueChange={(value) => setSelectedMonth(parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map((month) => (
                                        <SelectItem key={month} value={String(month)}>
                                            {format(new Date(selectedYear, month - 1), 'MMMM', { locale: ptBR })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Fatura selecionada:</p>
                        <p className="text-lg font-semibold capitalize">
                            {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleConfirm}>
                            Confirmar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

