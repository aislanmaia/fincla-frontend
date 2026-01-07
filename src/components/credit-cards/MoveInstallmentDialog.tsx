import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { InvoiceItemResponse, InvoiceResponse, MoveInstallmentRequest } from '@/types/api';
import { moveInstallmentToInvoice } from '@/api/creditCards';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, ArrowRight, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MoveInstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InvoiceItemResponse;
  currentInvoice: InvoiceResponse;
  cardId: number;
  organizationId: string;
  currentYear: number;
  currentMonth: number;
  onSuccess?: () => void;
}

interface InstallmentPreview {
  installmentNumber: number;
  currentMonth: string;
  newMonth: string;
  willChange: boolean;
}

export const MoveInstallmentDialog: React.FC<MoveInstallmentDialogProps> = ({
  open,
  onOpenChange,
  item,
  currentInvoice,
  cardId,
  organizationId,
  currentYear,
  currentMonth,
  onSuccess,
}) => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gerar opções de mês (atual ± 12 meses = 25 meses total)
  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; year: number; month: number }> = [];
    const baseDate = new Date(currentYear, currentMonth - 1);

    // Gerar 12 meses antes e 12 meses depois (25 total)
    for (let i = -12; i <= 12; i++) {
      const date = addMonths(baseDate, i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      const value = `${year}-${month.toString().padStart(2, '0')}`;

      options.push({ value, label, year, month });
    }

    return options;
  }, [currentYear, currentMonth]);

  // Calcular preview do impacto nas parcelas
  const impactPreview = useMemo((): InstallmentPreview[] => {
    if (!selectedYear || !selectedMonth) return [];

    const previews: InstallmentPreview[] = [];
    const targetMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    
    // Parse do mês atual da fatura (formato "YYYY-MM")
    const [currentYearStr, currentMonthStr] = currentInvoice.month.split('-');
    const currentMonthDate = new Date(parseInt(currentYearStr), parseInt(currentMonthStr) - 1, 1);

    // Calcular offset em meses
    const currentMonthIndex = currentMonthDate.getFullYear() * 12 + currentMonthDate.getMonth();
    const targetMonthIndex = targetMonthDate.getFullYear() * 12 + targetMonthDate.getMonth();
    const monthOffset = targetMonthIndex - currentMonthIndex;

    // Gerar preview para todas as parcelas
    // A parcela sendo movida (item.installment_number) vai para o mês de destino
    // As outras parcelas são posicionadas relativamente a ela
    for (let i = 1; i <= item.total_installments; i++) {
      // Posição relativa da parcela em relação à parcela sendo movida
      const relativePosition = i - item.installment_number;
      
      // Mês atual da parcela (assumindo que começou no mês da fatura atual)
      const currentParcelMonth = addMonths(currentMonthDate, relativePosition);
      
      // Novo mês da parcela (posicionada relativamente ao mês de destino)
      const newParcelMonth = addMonths(targetMonthDate, relativePosition);

      previews.push({
        installmentNumber: i,
        currentMonth: format(currentParcelMonth, 'MMMM yyyy', { locale: ptBR }),
        newMonth: format(newParcelMonth, 'MMMM yyyy', { locale: ptBR }),
        willChange: currentParcelMonth.getTime() !== newParcelMonth.getTime(),
      });
    }

    return previews;
  }, [selectedYear, selectedMonth, item, currentInvoice]);

  const handleMonthSelect = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedYear || !selectedMonth) {
      setError('Selecione uma fatura de destino');
      return;
    }

    // Validar se não é a mesma fatura atual
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const selectedMonthStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;
    
    if (currentMonthStr === selectedMonthStr) {
      setError('A fatura de destino deve ser diferente da fatura atual');
      return;
    }

    if (!item.charge_id) {
      setError('charge_id não encontrado na parcela');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const request: MoveInstallmentRequest = {
        target_year: selectedYear,
        target_month: selectedMonth,
      };

      await moveInstallmentToInvoice(
        cardId,
        item.charge_id,
        item.id, // installment_id
        organizationId,
        request
      );

      toast.success('Parcela movida com sucesso! Todas as parcelas foram recalculadas.');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Erro ao mover parcela:', err);
      const errorMessage =
        err.response?.data?.detail ||
        err.message ||
        'Erro ao mover parcela. Tente novamente.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMonthLabel = selectedYear && selectedMonth
    ? format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mover Parcela para Outra Fatura</DialogTitle>
          <DialogDescription>
            Ao mover esta parcela, todas as outras parcelas da mesma compra serão recalculadas
            automaticamente mantendo o intervalo de 1 mês entre elas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações da Parcela */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fatura atual:</span>
                <Badge variant="outline" className="font-medium">
                  {(() => {
                    // currentInvoice.month está no formato "YYYY-MM" (ex: "2026-01")
                    const [year, month] = currentInvoice.month.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return format(date, 'MMMM yyyy', { locale: ptBR });
                  })()}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Parcela sendo movida:</span>
                <Badge variant="secondary">
                  {item.installment_number}/{item.total_installments}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{item.description}</div>
              <div className="text-sm font-semibold">R$ {item.amount.toFixed(2)}</div>
            </div>
          </Card>

          {/* Seletor de Fatura Destino */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fatura de Destino</label>
            <Select
              value={
                selectedYear && selectedMonth
                  ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`
                  : undefined
              }
              onValueChange={handleMonthSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o mês/ano da fatura de destino" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMonthLabel && (
              <p className="text-xs text-muted-foreground">
                Fatura selecionada: <strong>{selectedMonthLabel}</strong>
              </p>
            )}
          </div>

          {/* Alert de Aviso */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Todas as {item.total_installments} parcelas desta compra
              serão recalculadas. A parcela selecionada será movida para a fatura de destino e as
              outras serão reposicionadas mantendo intervalo de 1 mês.
            </AlertDescription>
          </Alert>

          {/* Preview de Impacto */}
          {impactPreview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Preview do Impacto</h4>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {impactPreview.map((preview) => (
                  <Card
                    key={preview.installmentNumber}
                    className={cn(
                      'p-3 transition-colors',
                      preview.willChange && 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
                      preview.installmentNumber === item.installment_number &&
                        'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            preview.installmentNumber === item.installment_number
                              ? 'default'
                              : 'outline'
                          }
                        >
                          {preview.installmentNumber}/{item.total_installments}
                        </Badge>
                        {preview.installmentNumber === item.installment_number && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            (sendo movida)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={cn(
                            'text-sm flex-1 text-right',
                            preview.willChange && 'line-through text-muted-foreground'
                          )}
                        >
                          {preview.currentMonth}
                        </span>
                        {preview.willChange && (
                          <>
                            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300 flex-1">
                              {preview.newMonth}
                            </span>
                          </>
                        )}
                        {!preview.willChange && (
                          <span className="text-xs text-muted-foreground ml-2">(sem mudança)</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !selectedYear || !selectedMonth}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Movendo...
              </>
            ) : (
              'Confirmar Movimentação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

