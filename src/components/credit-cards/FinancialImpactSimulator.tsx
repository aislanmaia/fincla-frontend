import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertTriangle, CheckCircle2, TrendingDown, Wallet, Loader2, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { simulateFinancialImpact } from '@/api/financialImpact';
import { SimulateFinancialImpactResponse, MonthlyProjection } from '@/types/api';
import { toast } from 'sonner';
import { handleApiError } from '@/api/client';
import { useOrganization } from '@/hooks/useOrganization';
import { listCreditCards } from '@/api/creditCards';
import { CreditCard } from '@/types/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FinancialImpactSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCardInvoices?: Array<{ month: number; year: number; amount: number }>;
}

export function FinancialImpactSimulator({ 
  open, 
  onOpenChange,
  currentCardInvoices = []
}: FinancialImpactSimulatorProps) {
  const { activeOrgId } = useOrganization();
  const [step, setStep] = useState<'form' | 'loading' | 'results'>('form');
  
  // Form state
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installments, setInstallments] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  
  // Cards state
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  
  // Results state
  const [simulationData, setSimulationData] = useState<SimulateFinancialImpactResponse | null>(null);
  const [simulatedCard, setSimulatedCard] = useState<CreditCard | null>(null);
  
  // Load cards when component opens
  useEffect(() => {
    const loadCards = async () => {
      if (!open || !activeOrgId) return;
      
      try {
        setLoadingCards(true);
        const data = await listCreditCards(activeOrgId);
        setCards(data);
        if (data.length > 0 && !selectedCardId) {
          setSelectedCardId(String(data[0].id));
        }
      } catch (error) {
        console.error('Failed to load cards:', error);
        toast.error('Erro ao carregar cartões');
      } finally {
        setLoadingCards(false);
      }
    };
    
    loadCards();
  }, [open, activeOrgId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('form');
        setDescription('');
        setTotalAmount('');
        setInstallments('');
        setSelectedCardId('');
        setSimulationData(null);
        setSimulatedCard(null);
      }, 200);
    }
  }, [open]);

  const handleSimulate = async () => {
    const amount = parseFloat(totalAmount);
    const numInstallments = parseInt(installments);

    if (!amount || !numInstallments || numInstallments < 1) {
      return;
    }

    if (!description || description.trim().length === 0) {
      toast.error("Por favor, informe uma descrição para a compra.");
      return;
    }

    if (!selectedCardId) {
      toast.error("Por favor, selecione um cartão de crédito.");
      return;
    }

    try {
      setStep('loading');
      
      if (!activeOrgId) {
        toast.error("Organização não selecionada. Por favor, selecione uma organização.");
        setStep('form');
        return;
      }

      // Encontrar o cartão selecionado
      const selectedCard = cards.find(c => String(c.id) === selectedCardId);
      if (!selectedCard) {
        toast.error("Cartão selecionado não encontrado.");
        setStep('form');
        return;
      }

      // Validar número de parcelas
      if (numInstallments < 1 || numInstallments > 120) {
        toast.error("O número de parcelas deve estar entre 1 e 120.");
        setStep('form');
        return;
      }

      // Validar descrição
      if (description.length > 255) {
        toast.error("A descrição deve ter no máximo 255 caracteres.");
        setStep('form');
        return;
      }

      const result = await simulateFinancialImpact({
        organization_id: activeOrgId,
        new_card_commitments: [
          {
            card_last4: selectedCard.last4,
            value: amount,
            installments_count: numInstallments,
            description: description.trim()
          }
        ],
        simulation_months: Math.max(numInstallments, 6) // Simular pelo menos o número de parcelas ou 6 meses
      });
      
      // Log para diagnóstico: verificar se receitas estão sendo retornadas
      console.log('[FinancialImpactSimulator] Resultado da simulação:', {
        months: result.months?.map(m => ({
          month: m.month,
          projected_income: m.projected_income,
          base_expenses: m.base_expenses,
          card_commitments: m.card_commitments
        })),
        summary: result.summary
      });
      
      // Verificar se todas as receitas estão zeradas e alertar
      const allIncomesZero = result.months?.every(m => Number(m.projected_income) === 0);
      if (allIncomesZero && result.months && result.months.length > 0) {
        console.warn('[FinancialImpactSimulator] AVISO: Todas as receitas projetadas estão zeradas. O backend pode não estar identificando receitas recorrentes corretamente.');
        toast.warning('Receitas projetadas estão zeradas. Verifique se você possui transações de receita marcadas como recorrentes nos últimos 6 meses.', {
          duration: 5000
        });
      }
      
      setSimulationData(result);
      setSimulatedCard(selectedCard);
      setStep('results');
    } catch (error) {
      console.error("Simulation failed:", error);
      const errorMessage = handleApiError(error);
      toast.error(errorMessage || "Erro ao realizar simulação. Tente novamente.");
      setStep('form');
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'viable':
        return <CheckCircle2 className="w-12 h-12 text-green-500" />;
      case 'high-risk':
        return <AlertTriangle className="w-12 h-12 text-red-500" />;
      case 'caution':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      default:
        return <CheckCircle2 className="w-12 h-12 text-gray-500" />;
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'viable':
        return <Badge className="text-lg px-4 py-1 bg-green-500">✅ Compra Viável</Badge>;
      case 'high-risk':
        return <Badge variant="destructive" className="text-lg px-4 py-1">🔴 Alto Risco</Badge>;
      case 'caution':
        return <Badge className="text-lg px-4 py-1 bg-yellow-500 text-black">⚠️ Atenção Necessária</Badge>;
      default:
        return <Badge variant="outline">Em Análise</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                <DialogTitle className="text-lg sm:text-xl md:text-2xl">Simulador de Impacto Financeiro</DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                Veja como uma nova compra parcelada impactará seu orçamento futuro e suas metas de economia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">Descrição da Compra</Label>
                <Input
                  id="description"
                  placeholder="Ex: Notebook Dell Inspiron"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm"
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card" className="text-sm">Cartão de Crédito</Label>
                <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled={loadingCards || cards.length === 0}>
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder={loadingCards ? "Carregando cartões..." : cards.length === 0 ? "Nenhum cartão disponível" : "Selecione um cartão"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={String(card.id)}>
                        {card.description || `Cartão final ${card.last4}`} ({card.last4})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm">Valor Total</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0,00"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="pl-9 sm:pl-10 text-sm"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="installments" className="text-sm">Número de Parcelas</Label>
                  <Input
                    id="installments"
                    type="number"
                    placeholder="12"
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="text-sm"
                    min="1"
                    max="120"
                  />
                </div>
              </div>

              {totalAmount && installments && parseInt(installments) > 0 && (
                <Card className="p-3 sm:p-4 bg-muted">
                  <div className="text-xs sm:text-sm text-muted-foreground mb-1">Valor de cada parcela</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R$ {(parseFloat(totalAmount) / parseInt(installments)).toFixed(2)}
                  </div>
                </Card>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-sm">
                Cancelar
              </Button>
              <Button 
                onClick={handleSimulate}
                disabled={!description || !totalAmount || !installments || !selectedCardId || cards.length === 0}
                className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-sm"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                Simular Impacto
              </Button>
            </div>
          </>
        ) : step === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Analisando Saúde Financeira...</h3>
              <p className="text-sm text-muted-foreground">Calculando impacto em receitas, despesas e metas futuras.</p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 flex-shrink-0" />
                <DialogTitle className="text-lg sm:text-xl md:text-2xl">Análise de Impacto Financeiro</DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                {description && <span className="font-medium">Compra: {description}</span>}
              </DialogDescription>
            </DialogHeader>

            {simulationData && (
              <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
                {/* Purchase Summary */}
                <Card className="p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                    <div>
                      <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-0.5 sm:mb-1">Valor Total</div>
                      <div className="text-sm sm:text-lg md:text-xl font-bold">R$ {parseFloat(totalAmount).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-0.5 sm:mb-1">Parcelas</div>
                      <div className="text-sm sm:text-lg md:text-xl font-bold">{installments}x</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground mb-0.5 sm:mb-1">Impacto Mensal</div>
                      <div className="text-sm sm:text-lg md:text-xl font-bold text-indigo-600">
                        R$ {(parseFloat(totalAmount) / parseInt(installments)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Monthly Breakdown */}
                <div className="space-y-2 sm:space-y-3">
                  <h3 className="font-semibold text-base sm:text-lg flex items-center gap-1.5 sm:gap-2">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    Projeção Mensal Detalhada
                  </h3>
                  
                  <div className="space-y-1.5 sm:space-y-2 max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-1 sm:pr-2">
                    {simulationData.months.map((item: MonthlyProjection, index: number) => {
                      // Converter "YYYY-MM" para nome do mês
                      const [year, month] = item.month.split('-');
                      const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                      const monthName = monthDate.toLocaleString('pt-BR', { month: 'long' });
                      
                      // Calcular parcela mensal da nova compra
                      const monthlyInstallment = totalAmount && installments 
                        ? parseFloat(totalAmount) / parseInt(installments) 
                        : 0;
                      const hasNewInstallment = index < parseInt(installments || '0');
                      
                      return (
                        <Card
                          key={index}
                          className={cn(
                            'p-3 sm:p-4 transition-all',
                            item.status === 'danger' && 'border-red-300 bg-red-50 dark:bg-red-950/20',
                            item.status === 'warning' && 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20',
                            item.status === 'success' && 'border-green-300 bg-green-50 dark:bg-green-950/20'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                            <div className="font-semibold text-sm sm:text-base capitalize">{monthName} {year}</div>
                            {item.status === 'danger' ? (
                              <Badge variant="destructive" className="gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Déficit
                              </Badge>
                            ) : item.status === 'success' ? (
                              <Badge className="gap-0.5 sm:gap-1 bg-green-500 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Meta OK
                              </Badge>
                            ) : (
                              <Badge className="gap-0.5 sm:gap-1 bg-yellow-500 text-black text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Atenção
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-xs sm:text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Plus className="w-3 h-3 flex-shrink-0 text-green-600" />
                                Receitas:
                              </span>
                              <span className="font-medium text-green-600">R$ {Number(item.projected_income).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Minus className="w-3 h-3 flex-shrink-0 text-red-600" />
                                Despesas Base:
                              </span>
                              <span className="font-medium text-red-600">R$ {Number(item.base_expenses).toFixed(2)}</span>
                            </div>
                            {hasNewInstallment && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Minus className="w-3 h-3 flex-shrink-0 text-indigo-600" />
                                  Nova Parcela ({description}):
                                </span>
                                <span className="font-medium text-indigo-600">R$ {monthlyInstallment.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Minus className="w-3 h-3 flex-shrink-0 text-orange-600" />
                                {simulatedCard 
                                  ? `Compromisso mensal do Cartão ${simulatedCard.last4}:`
                                  : 'Compromissos Cartão:'}
                              </span>
                              <span className="font-medium text-orange-600">
                                R$ {(Number(item.card_commitments) - (hasNewInstallment ? monthlyInstallment : 0)).toFixed(2)}
                              </span>
                            </div>
                            {Number(item.savings_goal) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Minus className="w-3 h-3 flex-shrink-0 text-blue-600" />
                                  Meta de Economia:
                                </span>
                                <span className="font-medium text-blue-600">R$ {Number(item.savings_goal).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Minus className="w-3 h-3 flex-shrink-0 text-red-600" />
                                Total Despesas:
                              </span>
                              <span className="font-medium text-red-600">R$ {Number(item.total_expenses).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between col-span-1 sm:col-span-2 pt-1.5 sm:pt-2 border-t mt-1">
                              <span className="font-semibold text-xs sm:text-sm">= Saldo Previsto:</span>
                              <span className={cn(
                                'font-bold text-xs sm:text-sm',
                                Number(item.balance) < 0 && 'text-red-600',
                                Number(item.balance) >= 0 && 'text-green-600'
                              )}>
                                R$ {Number(item.balance).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Final Verdict */}
                <Card className={cn(
                  'p-4 sm:p-5 md:p-6',
                  simulationData.global_verdict === 'viable' && 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20',
                  simulationData.global_verdict === 'high-risk' && 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20',
                  simulationData.global_verdict === 'caution' && 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20'
                )}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0">
                      {getVerdictIcon(simulationData.global_verdict)}
                    </div>
                    <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h3 className="font-bold text-base sm:text-lg md:text-xl">Conclusão da Análise</h3>
                        {getVerdictBadge(simulationData.global_verdict)}
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed">
                        {simulationData.global_verdict === 'viable' && 
                          'Compra segura! Seu orçamento comporta esta despesa sem afetar suas metas.'}
                        {simulationData.global_verdict === 'caution' && 
                          'Atenção necessária. Alguns meses podem ser apertados, mas a compra é viável com cuidado.'}
                        {simulationData.global_verdict === 'high-risk' && 
                          'Alto risco! Esta compra pode comprometer seriamente sua saúde financeira. Recomenda-se reconsiderar.'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('form')} className="w-full sm:w-auto text-sm">
                Nova Simulação
              </Button>
              <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-sm">
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
