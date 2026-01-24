// lib/analytics.ts
// Processa transações do backend para gerar analytics no frontend

import { Transaction } from '@/types/api';
import { generateDistinctCategoryColors } from './colorGenerator';
import { startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, startOfDay, isSameDay, isAfter, isBefore } from 'date-fns';

// Função auxiliar para gerar hash de string (usada para garantir unicidade de cores)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Função auxiliar para converter HSL para hexadecimal (usada no fallback de cores)
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export interface FinancialSummary {
    balance: number;
    income: number;
    expenses: number;
    savingsGoal?: number;
    savingsProgress?: number;
}

export interface MonthlyData {
    month: string;
    income: number;
    expenses: number;
}

export interface ExpenseCategory {
    name: string;
    amount: number;
    color: string;
}

export interface MoneyFlowNode {
    id: string;
    name: string;
    category: 'income' | 'expense';
    type?: 'regular' | 'goal' | 'investment' | 'debt';
}

export interface MoneyFlowLink {
    source: string;
    target: string;
    value: number;
}

export interface MoneyFlow {
    nodes: MoneyFlowNode[];
    links: MoneyFlowLink[];
}

export interface WeeklyExpenseHeatmap {
    categories: string[];
    days: string[];
    data: number[][];
}

/**
 * Calcula o valor de uma transação considerando parcelas de cartão de crédito
 * Para transações parceladas, retorna o valor da parcela que vence no período
 * @param transaction - Transação a ser processada
 * @param dateRange - Opcional: range de datas para calcular qual parcela vence
 * @returns Valor a ser contabilizado (parcela ou valor total)
 */
function getTransactionValue(
    transaction: Transaction,
    dateRange?: { from: Date; to: Date },
    includeCreditCardInvoices?: boolean
): number {
    const numericValue = typeof transaction.value === 'string' 
        ? parseFloat(transaction.value) 
        : transaction.value;

    // Se não é transação de cartão parcelada, retornar valor total
    const isCreditCard = transaction.payment_method === 'Cartão de Crédito' || 
                        transaction.payment_method === 'credit_card';
    const isInstallment = transaction.modality === 'installment' || 
                        transaction.credit_card_charge?.charge.modality === 'installment';
    const installmentsCount = transaction.installments_count || 
                             transaction.credit_card_charge?.charge.installments_count || 
                             1;

    if (!isCreditCard || !isInstallment || installmentsCount <= 1) {
        // Para transações não parceladas, verificar se a data está no período
        if (dateRange) {
            const transactionDate = new Date(transaction.date);
            const transactionDateStart = startOfDay(transactionDate);
            const rangeFromStart = startOfDay(dateRange.from);
            const rangeToStart = startOfDay(dateRange.to);
            
            // Para transações de cartão de crédito não parceladas, considerar que podem estar
            // em faturas que fecham no período. Faturas podem fechar no mês seguinte ou no mês seguinte ao seguinte,
            // dependendo da data de fechamento do cartão.
            let isInRange = transactionDateStart >= rangeFromStart && transactionDateStart <= rangeToStart;
            
            // Se é cartão de crédito e não está no período, verificar se pode estar em fatura
            // Mas apenas se includeCreditCardInvoices for true (usado apenas para categorias)
            if (isCreditCard && !isInRange && includeCreditCardInvoices) {
                // Calcular o mês da transação e o mês do período
                const transactionMonth = startOfMonth(transactionDate);
                const rangeStartMonth = startOfMonth(dateRange.from);
                const rangeEndMonth = startOfMonth(dateRange.to);
                
                // Faturas podem fechar no mês seguinte (mais comum) ou no mês seguinte ao seguinte
                // Incluir transações cuja fatura pode fechar no período
                const invoiceMonth1 = addMonths(transactionMonth, 1); // Mês seguinte (mais comum)
                const invoiceMonth2 = addMonths(transactionMonth, 2); // Mês seguinte ao seguinte (se fecha no início do mês)
                
                // Verificar se algum dos meses possíveis de fechamento está dentro do período
                if ((invoiceMonth1 >= rangeStartMonth && invoiceMonth1 <= rangeEndMonth) ||
                    (invoiceMonth2 >= rangeStartMonth && invoiceMonth2 <= rangeEndMonth)) {
                    isInRange = true;
                }
            }
            
            if (!isInRange) {
                return 0; // Transação fora do período
            }
        }
        return numericValue;
    }

    // Para transações parceladas, calcular valor da parcela
    const totalAmount = transaction.credit_card_charge?.charge.total_amount || numericValue;
    const installmentValue = totalAmount / installmentsCount;

    // Se não há dateRange, retornar valor total (comportamento antigo)
    if (!dateRange) {
        return numericValue;
    }

    // Calcular qual parcela vence no período
    const purchaseDate = transaction.credit_card_charge?.charge.purchase_date 
        ? new Date(transaction.credit_card_charge.charge.purchase_date)
        : new Date(transaction.date);
    
    // A primeira parcela geralmente vence no mês seguinte à compra
    // Vamos calcular em qual mês cada parcela vence
    let totalInstallmentValue = 0;
    
    for (let i = 1; i <= installmentsCount; i++) {
        // Parcela i vence aproximadamente i meses após a compra
        // Usar o início do mês seguinte à compra como base
        const installmentMonth = addMonths(startOfMonth(purchaseDate), i);
        const installmentMonthStart = startOfMonth(installmentMonth);
        const installmentMonthEnd = endOfMonth(installmentMonth);
        
        // Verificar se a parcela vence dentro do período selecionado
        if (isWithinInterval(installmentMonthStart, { start: dateRange.from, end: dateRange.to }) ||
            isWithinInterval(installmentMonthEnd, { start: dateRange.from, end: dateRange.to }) ||
            (installmentMonthStart <= dateRange.to && installmentMonthEnd >= dateRange.from)) {
            totalInstallmentValue += installmentValue;
        }
    }

    // Se nenhuma parcela vence no período, retornar 0
    // Caso contrário, retornar a soma das parcelas que vencem no período
    const result = totalInstallmentValue > 0 ? totalInstallmentValue : 0;
    
    return result;
}

/**
 * Processa transações para gerar resumo financeiro
 * @param transactions - Lista de transações
 * @param dateRange - Opcional: range de datas para filtrar transações
 * @param creditCardInvoicesTotal - Opcional: valor total das faturas de cartão que fecham no período
 */
export function calculateSummary(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date },
    creditCardInvoicesTotal?: number
): FinancialSummary {
    // Para receitas, filtrar por data da transação
    // Para despesas, usar getTransactionValue que já considera parcelas
    let filteredIncomeTransactions = transactions.filter((t) => t.type === 'income');
    if (dateRange) {
        filteredIncomeTransactions = filteredIncomeTransactions.filter((t) => {
            const transactionDate = new Date(t.date);
            const transactionDateStart = startOfDay(transactionDate);
            const rangeFromStart = startOfDay(dateRange.from);
            const rangeToStart = startOfDay(dateRange.to);
            return transactionDateStart >= rangeFromStart && transactionDateStart <= rangeToStart;
        });
    }

    const income = filteredIncomeTransactions.reduce((acc, t) => {
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        return acc + value;
    }, 0);

    // Para despesas, filtrar por data quando há dateRange
    // Para transações não parceladas, verificar se a data está no período
    // Para transações parceladas, usar getTransactionValue que já considera parcelas
    let expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((acc, t) => {
            if (dateRange) {
                // Para transações não parceladas, verificar se a data está no período
                const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                                    t.payment_method === 'credit_card';
                const isInstallment = t.modality === 'installment' || 
                                     t.credit_card_charge?.charge.modality === 'installment';
                const installmentsCount = t.installments_count || 
                                         t.credit_card_charge?.charge.installments_count || 
                                         1;
                
                // Usar getTransactionValue que já faz a verificação de data corretamente
                // para transações parceladas e não parceladas
                const value = getTransactionValue(t, dateRange);
                return acc + value;
            } else {
                // Sem dateRange, usar valor total
                const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
                return acc + value;
            }
        }, 0);

    // Adicionar valor total das faturas de cartão de crédito que fecham no período
    // Isso representa o valor que o usuário precisa pagar naquele mês
    if (creditCardInvoicesTotal !== undefined && creditCardInvoicesTotal > 0) {
        expenses += creditCardInvoicesTotal;
    }

    const balance = income - expenses;

    return {
        balance,
        income,
        expenses,
    };
}

/**
 * Agrupa transações por mês para gráfico temporal
 * Considera parcelas de cartão de crédito corretamente
 */
export function groupByMonth(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date },
    creditCardInvoicesTotal?: number,
    creditCardInvoicesByMonth?: Array<{ year: number; month: number; total: number }>
): MonthlyData[] {
    // Para o gráfico "Receitas vs Despesas", sempre mostrar os últimos 6 meses
    // independente do dateRange selecionado
    const now = new Date();
    const chartStartDate = startOfMonth(subMonths(now, 5)); // 6 meses atrás (incluindo o mês atual)
    const chartEndDate = endOfMonth(now);
    
    // Inicializar o monthMap com todos os meses dos últimos 6 meses
    const monthMap = new Map<string, { income: number; expenses: number }>();
    for (let i = 0; i < 6; i++) {
        const month = subMonths(now, 5 - i);
        const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, { income: 0, expenses: 0 });
    }
    
    let expenseProcessedCount = 0;
    let expenseSkippedCount = 0;

    let incomeCount = 0;
    let expenseCount = 0;
    let incomeAdded = 0;
    let expenseAdded = 0;
    
    transactions.forEach((t) => {
        // Para receitas, usar valor total (sempre incluir se estiver nos últimos 6 meses)
        if (t.type === 'income') {
            incomeCount++;
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Só incluir se o mês estiver nos últimos 6 meses
            if (monthMap.has(monthKey)) {
                const data = monthMap.get(monthKey)!;
                const numericValue = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
                data.income += numericValue;
                incomeAdded++;
            }
        } else {
            expenseProcessedCount++;
            expenseCount++;
            // Para despesas, considerar parcelas de cartão
            const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                                t.payment_method === 'credit_card';
            const isInstallment = t.modality === 'installment' || 
                                 t.credit_card_charge?.charge.modality === 'installment';
            const installmentsCount = t.installments_count || 
                                     t.credit_card_charge?.charge.installments_count || 
                                     1;

            if (isCreditCard && isInstallment && installmentsCount > 1) {
                // Transação parcelada: distribuir parcelas pelos meses
                const purchaseDate = t.credit_card_charge?.charge.purchase_date 
                    ? new Date(t.credit_card_charge.charge.purchase_date)
                    : new Date(t.date);
                const totalAmount = t.credit_card_charge?.charge.total_amount || 
                                   (typeof t.value === 'string' ? parseFloat(t.value) : t.value);
                const installmentValue = totalAmount / installmentsCount;

                // Distribuir cada parcela no mês correspondente
                let installmentAdded = 0;
                for (let i = 1; i <= installmentsCount; i++) {
                    const installmentMonth = addMonths(startOfMonth(purchaseDate), i);
                    const monthKey = `${installmentMonth.getFullYear()}-${String(installmentMonth.getMonth() + 1).padStart(2, '0')}`;
                    
                    // Só incluir se o mês estiver nos últimos 6 meses
                    if (monthMap.has(monthKey)) {
                        const data = monthMap.get(monthKey)!;
                        data.expenses += installmentValue;
                        installmentAdded++;
                        expenseAdded++;
                    } else {
                        expenseSkippedCount++;
                    }
                }
            } else {
                // Transação não parcelada: processar se estiver nos últimos 6 meses
                const date = new Date(t.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
                
                // Só incluir se o mês estiver nos últimos 6 meses
                if (monthMap.has(monthKey)) {
                    const data = monthMap.get(monthKey)!;
                    data.expenses += value;
                    expenseAdded++;
                } else {
                    expenseSkippedCount++;
                }
            }
        }
    });

    // Adicionar faturas de cartão de crédito que fecham em cada mês
    if (creditCardInvoicesByMonth && creditCardInvoicesByMonth.length > 0) {
        creditCardInvoicesByMonth.forEach((invoice) => {
            const monthKey = `${invoice.year}-${String(invoice.month).padStart(2, '0')}`;
            if (monthMap.has(monthKey)) {
                const data = monthMap.get(monthKey)!;
                data.expenses += invoice.total;
            }
        });
    }

    // Converter para array e ordenar por data
    const result = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, data]) => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1);
            const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });

            return {
                month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
                income: data.income,
                expenses: data.expenses,
            };
        });
    
    return result;
}

/**
 * Extrai categoria principal de uma transação
 * (pega primeira tag do tipo "categoria" ou categoria legado)
 */
function getMainCategory(transaction: Transaction): string {
    // Priorizar campo category legado se existir
    if (transaction.category) {
        return transaction.category;
    }

    // Verificar se tags é um Record (formato atual do backend)
    if (transaction.tags && !Array.isArray(transaction.tags)) {
        const categoryTags = transaction.tags['categoria'];
        if (categoryTags && categoryTags.length > 0) {
            return categoryTags[0].name;
        }
    }

    // Se usar tags (array), procurar tag do tipo "categoria" (formato legado)
    if (Array.isArray(transaction.tags)) {
        const categoryTag = transaction.tags.find(
            (tag) => tag.tag_type?.name === 'categoria'
        );
        if (categoryTag) {
            return categoryTag.name;
        }
    }

    return 'Outros';
}

/**
 * Agrupa despesas por categoria
 * Considera parcelas de cartão de crédito corretamente
 */
export function groupByCategory(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date },
    creditCardInvoicesTotal?: number,
    creditCardCategoryBreakdown?: Array<{ category_name: string; total: number }>
): ExpenseCategory[] {
    const categoryMap = new Map<string, number>();

    // Filtrar apenas despesas
    const expenses = transactions.filter((t) => t.type === 'expense');

    // Se há category_breakdown das faturas, NÃO processar transações de cartão de crédito
    // para evitar duplicação (as faturas já contêm essas transações)
    const shouldSkipCreditCard = creditCardCategoryBreakdown && creditCardCategoryBreakdown.length > 0;
    
    let zeroValueCount = 0;
    expenses.forEach((t) => {
        // Pular transações de cartão de crédito se há category_breakdown (para evitar duplicação)
        const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                            t.payment_method === 'credit_card';
        if (shouldSkipCreditCard && isCreditCard) {
            return; // Pular transações de cartão quando há breakdown das faturas
        }
        
        const category = getMainCategory(t);
        const current = categoryMap.get(category) || 0;
        // Usar função que considera parcelas (mas não incluir cartão quando há breakdown)
        const value = dateRange ? getTransactionValue(t, dateRange, false) : getTransactionValue(t);
        if (value === 0) {
            zeroValueCount++;
        }
        categoryMap.set(category, current + value);
    });

    // Adicionar categorias das faturas de cartão de crédito ANTES de gerar cores
    // IMPORTANTE: Usar APENAS o category_breakdown das faturas, não tentar adivinhar transações
    // porque as transações individuais já estão sendo processadas acima e podem causar duplicação
    if (creditCardCategoryBreakdown && creditCardCategoryBreakdown.length > 0) {
        creditCardCategoryBreakdown.forEach((breakdown) => {
            const categoryName = breakdown.category_name || 'Sem Categoria';
            const current = categoryMap.get(categoryName) || 0;
            categoryMap.set(categoryName, current + breakdown.total);
        });
    }

    // Gerar cores distintas dinamicamente para TODAS as categorias (incluindo as das faturas)
    const categoryNames = Array.from(categoryMap.keys());
    const colorMap = generateDistinctCategoryColors(categoryNames);

    // Garantir que todas as categorias tenham cores claras e vibrantes
    // Verificar se há cores duplicadas e corrigir
    const usedColors = new Set<string>();
    const result = Array.from(categoryMap.entries())
        .filter(([name, amount]) => amount > 0) // Filtrar categorias com valor 0 (fora do período)
        .map(([name, amount], index) => {
            // Se não há cor no map, gerar uma cor clara e vibrante como fallback
            let color = colorMap.get(name);
            if (!color) {
                // Gerar cor clara e vibrante baseada no índice e hash do nome para garantir unicidade
                const nameHash = hashString(name.toLowerCase().trim());
                const baseHue = (index * 137.508) % 360; // Golden angle para distribuição uniforme
                const hueVariation = (nameHash % 30) - 15; // Variação de -15 a +15 graus
                let hue = (baseHue + hueVariation + 360) % 360;
                let saturation = 70 + (nameHash % 16); // 70-85% - cores vibrantes
                let lightness = 55 + ((nameHash * 7) % 16); // 55-70% - cores claras
                
                // Garantir que a cor seja única (se já foi usada, ajustar)
                let attempts = 0;
                do {
                    color = hslToHex(hue, saturation, lightness);
                    if (!usedColors.has(color)) break;
                    // Ajustar ligeiramente o hue para gerar uma cor diferente
                    hue = (hue + 25) % 360;
                    saturation = 70 + ((saturation + attempts) % 16);
                    lightness = 55 + ((lightness + attempts * 3) % 16);
                    attempts++;
                } while (attempts < 20);
            } else {
                // Se a cor já foi usada, ajustar ligeiramente
                if (usedColors.has(color)) {
                    const nameHash = hashString(name.toLowerCase().trim());
                    let hue = (nameHash * 137.508) % 360;
                    let saturation = 70 + (nameHash % 16);
                    let lightness = 55 + ((nameHash * 7) % 16);
                    let attempts = 0;
                    do {
                        color = hslToHex(hue, saturation, lightness);
                        if (!usedColors.has(color)) break;
                        hue = (hue + 25) % 360;
                        saturation = 70 + ((saturation + attempts) % 16);
                        lightness = 55 + ((lightness + attempts * 3) % 16);
                        attempts++;
                    } while (attempts < 20);
                }
            }
            
            usedColors.add(color);
            return {
                name,
                amount,
                color,
            };
        })
        .sort((a, b) => b.amount - a.amount); // Ordenar por valor decrescente
    
    return result;
}

/**
 * Gera dados para gráfico de fluxo de dinheiro (Sankey)
 * Simplificado - agrupa receitas e despesas por categoria
 */
export function generateMoneyFlow(transactions: Transaction[]): MoneyFlow {
    const nodes: MoneyFlowNode[] = [];
    const links: MoneyFlowLink[] = [];
    const nodeIds = new Set<string>();

    // Separar receitas e despesas
    const incomes = transactions.filter((t) => t.type === 'income');
    const expenses = transactions.filter((t) => t.type === 'expense');

    // Criar nós de receita
    const incomeByMethod = new Map<string, number>();
    incomes.forEach((t) => {
        const method = t.payment_method || 'Receita';
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        incomeByMethod.set(method, (incomeByMethod.get(method) || 0) + value);
    });

    incomeByMethod.forEach((value, method) => {
        const id = `income_${method.toLowerCase().replace(/\s+/g, '_')}`;
        if (!nodeIds.has(id)) {
            nodes.push({ id, name: method, category: 'income' });
            nodeIds.add(id);
        }
    });

    // Criar nós de despesa
    const expenseByCategory = new Map<string, number>();
    expenses.forEach((t) => {
        const category = getMainCategory(t);
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        expenseByCategory.set(category, (expenseByCategory.get(category) || 0) + value);
    });

    expenseByCategory.forEach((value, category) => {
        const id = `expense_${category.toLowerCase().replace(/\s+/g, '_')}`;
        if (!nodeIds.has(id)) {
            nodes.push({ id, name: category, category: 'expense' });
            nodeIds.add(id);
        }
    });

    // Criar links (simplificado: distribuir receitas proporcionalmente para despesas)
    const totalIncome = incomes.reduce((acc, t) => {
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        return acc + value;
    }, 0);
    const totalExpenses = expenses.reduce((acc, t) => {
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        return acc + value;
    }, 0);

    if (totalIncome > 0 && totalExpenses > 0) {
        incomeByMethod.forEach((incomeValue, incomeMethod) => {
            const incomeId = `income_${incomeMethod.toLowerCase().replace(/\s+/g, '_')}`;

            expenseByCategory.forEach((expenseValue, expenseCategory) => {
                const expenseId = `expense_${expenseCategory.toLowerCase().replace(/\s+/g, '_')}`;

                // Distribuir proporcionalmente
                const linkValue = (incomeValue / totalIncome) * expenseValue;

                if (linkValue > 0) {
                    links.push({
                        source: incomeId,
                        target: expenseId,
                        value: Math.round(linkValue * 100) / 100,
                    });
                }
            });
        });
    }

    return { nodes, links };
}

/**
 * Gera heatmap de gastos por dia da semana e categoria
 */
export function generateWeeklyHeatmap(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date }
): WeeklyExpenseHeatmap {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const expenses = transactions.filter((t) => t.type === 'expense');

    // Pegar categorias únicas das transações
    const categorySet = new Set<string>();
    expenses.forEach((t) => {
        categorySet.add(getMainCategory(t));
    });
    const categories = Array.from(categorySet).sort();

    // Inicializar matriz [dia][categoria]
    const data: number[][] = Array(7)
        .fill(0)
        .map(() => Array(categories.length).fill(0));

    // Preencher matriz
    // IMPORTANTE: Para o heatmap semanal, mostramos apenas transações que REALMENTE ocorreram no período selecionado
    // (baseado na data da transação), não baseado na data de fechamento da fatura
    // O heatmap semanal é sobre quando os gastos foram feitos, não quando as faturas fecham
    let totalValue = 0;
    
    expenses.forEach((t) => {
        const date = new Date(t.date);
        
        // Verificar se a data da transação está dentro do período selecionado
        if (dateRange) {
            const transactionDateStart = startOfDay(date);
            const rangeFromStart = startOfDay(dateRange.from);
            const rangeToStart = startOfDay(dateRange.to);
            
            // A transação só deve aparecer se sua data estiver dentro do período
            const isInRange = transactionDateStart >= rangeFromStart && transactionDateStart <= rangeToStart;
            
            if (!isInRange) {
                return; // Pular se a data da transação está fora do período
            }
        }
        
        // Calcular valor da transação
        let value = 0;
        if (dateRange) {
            // Para transações parceladas, calcular apenas a parcela que vence no período
            const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                                t.payment_method === 'credit_card';
            const isInstallment = t.modality === 'installment' || 
                                 t.credit_card_charge?.charge.modality === 'installment';
            const installmentsCount = t.installments_count || 
                                     t.credit_card_charge?.charge.installments_count || 
                                     1;
            
            if (isCreditCard && isInstallment && installmentsCount > 1) {
                // Para transações parceladas, calcular apenas a parcela que vence no período
                value = getTransactionValue(t, dateRange, false);
            } else {
                // Para transações não parceladas, usar o valor total
                value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
            }
            
            if (value === 0) {
                return; // Pular se não há valor no período
            }
        } else {
            value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        }
        
        // Para determinar o dia da semana, usar a data real da transação
        const dayIndex = date.getDay(); // 0 = Domingo, 6 = Sábado
        const category = getMainCategory(t);
        const categoryIndex = categories.indexOf(category);

        if (categoryIndex >= 0) {
            data[dayIndex][categoryIndex] += value;
            totalValue += value;
        }
    });

    const result = { categories, days, data };
    
    return result;
}

/**
 * Função principal que processa todas as analytics
 * @param transactions - Lista de transações
 * @param dateRange - Opcional: range de datas para filtrar transações
 */
export function processTransactionAnalytics(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date },
    creditCardInvoicesTotal?: number,
    creditCardCategoryBreakdown?: Array<{ category_name: string; total: number }>,
    creditCardInvoicesByMonth?: Array<{ year: number; month: number; total: number }>
) {
    // Para transações parceladas, não filtrar pela data da transação original
    // mas sim considerar todas as transações que podem ter parcelas vencendo no período
    // As funções de cálculo já fazem essa verificação internamente
    // IMPORTANTE: Não filtrar as transações aqui! Deixar que as funções de cálculo
    // (groupByMonth, groupByCategory, generateWeeklyHeatmap) façam o filtro interno
    // baseado em dateRange, pois elas precisam processar todas as transações para
    // calcular corretamente parcelas que vencem no período
    let filteredTransactions = transactions;

    const summary = calculateSummary(filteredTransactions, dateRange, creditCardInvoicesTotal);
    const monthly = groupByMonth(filteredTransactions, dateRange, creditCardInvoicesTotal, creditCardInvoicesByMonth);
    const categories = groupByCategory(filteredTransactions, dateRange, creditCardInvoicesTotal, creditCardCategoryBreakdown);
    const heatmap = generateWeeklyHeatmap(filteredTransactions, dateRange);
    
    return {
        summary,
        monthly,
        categories,
        moneyFlow: generateMoneyFlow(filteredTransactions),
        heatmap,
    };
}
