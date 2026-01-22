// lib/analytics.ts
// Processa transações do backend para gerar analytics no frontend

import { Transaction } from '@/types/api';
import { generateDistinctCategoryColors } from './colorGenerator';
import { startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval } from 'date-fns';

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
    dateRange?: { from: Date; to: Date }
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
            return transactionDate >= dateRange.from && transactionDate <= dateRange.to;
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
                
                // Se não é parcelada, verificar se a data está no período
                if (!(isCreditCard && isInstallment && installmentsCount > 1)) {
                    const transactionDate = new Date(t.date);
                    if (transactionDate < dateRange.from || transactionDate > dateRange.to) {
                        return acc; // Pular se a data não está no período
                    }
                }
                
                // Para parceladas ou não parceladas no período, usar getTransactionValue
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
    creditCardInvoicesTotal?: number
): MonthlyData[] {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:199',message:'groupByMonth entry',data:{transactionsCount:transactions.length,dateRange:dateRange?{from:dateRange.from.toISOString(),to:dateRange.to.toISOString()}:null,creditCardInvoicesTotal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
    
    // #region agent log
    const monthKeys = Array.from(monthMap.keys());
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:216',message:'monthMap initialized',data:{monthKeys,now:now.toISOString(),chartStartDate:chartStartDate.toISOString(),chartEndDate:chartEndDate.toISOString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
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
                // #region agent log
                if (expenseProcessedCount <= 10) {
                    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:244',message:'installment expense processed',data:{transactionId:t.id,description:t.description,purchaseDate:purchaseDate.toISOString(),installmentsCount,totalAmount,installmentValue,installmentAdded,monthKeys:Array.from(monthMap.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                }
                // #endregion
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
                // #region agent log
                if (expenseProcessedCount <= 10) {
                    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:267',message:'non-installment expense processed',data:{transactionId:t.id,description:t.description,date:date.toISOString(),monthKey,value,isInMonthMap:monthMap.has(monthKey),monthKeys:Array.from(monthMap.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                }
                // #endregion
            }
        }
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:281',message:'transactions processing summary',data:{incomeCount,incomeAdded,expenseCount,expenseAdded,expenseProcessedCount,expenseSkippedCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // NÃO adicionar creditCardInvoicesTotal ao gráfico mensal
    // O gráfico mensal mostra meses completos, enquanto creditCardInvoicesTotal
    // representa faturas que fecham apenas no período selecionado (que pode ser parcial)
    // creditCardInvoicesTotal deve aparecer apenas no resumo (summary), não no gráfico

    // #region agent log
    const monthMapBeforeConversion = Array.from(monthMap.entries()).map(([key, data]) => ({key,income:data.income,expenses:data.expenses}));
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:288',message:'monthMap before conversion',data:{monthMapData:monthMapBeforeConversion},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
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
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/64fc74d5-2f72-478d-b268-2554f07bb069',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'analytics.ts:303',message:'groupByMonth result',data:{result,resultLength:result.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
    dateRange?: { from: Date; to: Date }
): ExpenseCategory[] {
    const categoryMap = new Map<string, number>();

    // Filtrar apenas despesas
    const expenses = transactions.filter((t) => t.type === 'expense');

    let zeroValueCount = 0;
    expenses.forEach((t) => {
        const category = getMainCategory(t);
        const current = categoryMap.get(category) || 0;
        // Usar função que considera parcelas
        const value = dateRange ? getTransactionValue(t, dateRange) : getTransactionValue(t);
        if (value === 0) zeroValueCount++;
        categoryMap.set(category, current + value);
    });

    // Gerar cores distintas dinamicamente para todas as categorias
    const categoryNames = Array.from(categoryMap.keys());
    const colorMap = generateDistinctCategoryColors(categoryNames);

    const result = Array.from(categoryMap.entries())
        .map(([name, amount]) => ({
            name,
            amount,
            color: colorMap.get(name) || '#6B7280', // Fallback caso algo dê errado
        }))
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

    // Pegar categorias únicas
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
    let totalValue = 0;
    expenses.forEach((t) => {
        const date = new Date(t.date);
        const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                            t.payment_method === 'credit_card';
        const isInstallment = t.modality === 'installment' || 
                             t.credit_card_charge?.charge.modality === 'installment';
        const installmentsCount = t.installments_count || 
                                 t.credit_card_charge?.charge.installments_count || 
                                 1;
        
        // Calcular valor da transação considerando dateRange
        let value = 0;
        if (dateRange) {
            // Usar getTransactionValue para todas as transações quando há dateRange
            // Isso garante que parcelas sejam calculadas corretamente
            value = getTransactionValue(t, dateRange);
            if (value === 0) {
                return; // Pular se não há valor no período
            }
        } else {
            value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
        }
        
        // Para determinar o dia da semana, usar a data da transação
        // (ou a data da primeira parcela que vence no período, se aplicável)
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
    creditCardInvoicesTotal?: number
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
    const monthly = groupByMonth(filteredTransactions, dateRange, creditCardInvoicesTotal);
    const categories = groupByCategory(filteredTransactions, dateRange);
    const heatmap = generateWeeklyHeatmap(filteredTransactions, dateRange);
    
    return {
        summary,
        monthly,
        categories,
        moneyFlow: generateMoneyFlow(filteredTransactions),
        heatmap,
    };
}
