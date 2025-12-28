// lib/analytics.ts
// Processa transações do backend para gerar analytics no frontend

import { Transaction } from '@/types/api';
import { generateDistinctCategoryColors } from './colorGenerator';
import { startOfMonth, endOfMonth, addMonths, isWithinInterval } from 'date-fns';

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
    return totalInstallmentValue > 0 ? totalInstallmentValue : 0;
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

    // Para despesas, usar todas as transações e deixar getTransactionValue calcular
    // o valor correto baseado em parcelas que vencem no período
    let expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((acc, t) => {
            // getTransactionValue já considera se a parcela vence no período
            const value = dateRange ? getTransactionValue(t, dateRange) : getTransactionValue(t);
            return acc + value;
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
    dateRange?: { from: Date; to: Date }
): MonthlyData[] {
    const monthMap = new Map<string, { income: number; expenses: number }>();

    transactions.forEach((t) => {
        // Para receitas, usar valor total
        if (t.type === 'income') {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, { income: 0, expenses: 0 });
            }
            
            const data = monthMap.get(monthKey)!;
            const numericValue = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
            data.income += numericValue;
        } else {
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
                for (let i = 1; i <= installmentsCount; i++) {
                    const installmentMonth = addMonths(startOfMonth(purchaseDate), i);
                    const monthKey = `${installmentMonth.getFullYear()}-${String(installmentMonth.getMonth() + 1).padStart(2, '0')}`;
                    
                    // Se há dateRange, verificar se o mês está dentro do range
                    if (dateRange) {
                        const monthStart = startOfMonth(installmentMonth);
                        const monthEnd = endOfMonth(installmentMonth);
                        if (!(monthStart <= dateRange.to && monthEnd >= dateRange.from)) {
                            continue; // Pular se o mês não está no range
                        }
                    }

                    if (!monthMap.has(monthKey)) {
                        monthMap.set(monthKey, { income: 0, expenses: 0 });
                    }

                    const data = monthMap.get(monthKey)!;
                    data.expenses += installmentValue;
                }
            } else {
                // Transação não parcelada: usar valor total no mês da transação
                const date = new Date(t.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                // Se há dateRange, verificar se o mês está dentro do range
                if (dateRange) {
                    const monthStart = startOfMonth(date);
                    const monthEnd = endOfMonth(date);
                    if (!(monthStart <= dateRange.to && monthEnd >= dateRange.from)) {
                        return; // Pular se o mês não está no range
                    }
                }

                if (!monthMap.has(monthKey)) {
                    monthMap.set(monthKey, { income: 0, expenses: 0 });
                }

                const data = monthMap.get(monthKey)!;
                const numericValue = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
                data.expenses += numericValue;
            }
        }
    });

    // Converter para array e ordenar por data
    return Array.from(monthMap.entries())
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

    expenses.forEach((t) => {
        const category = getMainCategory(t);
        const current = categoryMap.get(category) || 0;
        // Usar função que considera parcelas
        const value = dateRange ? getTransactionValue(t, dateRange) : getTransactionValue(t);
        categoryMap.set(category, current + value);
    });

    // Gerar cores distintas dinamicamente para todas as categorias
    const categoryNames = Array.from(categoryMap.keys());
    const colorMap = generateDistinctCategoryColors(categoryNames);

    return Array.from(categoryMap.entries())
        .map(([name, amount]) => ({
            name,
            amount,
            color: colorMap.get(name) || '#6B7280', // Fallback caso algo dê errado
        }))
        .sort((a, b) => b.amount - a.amount); // Ordenar por valor decrescente
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
export function generateWeeklyHeatmap(transactions: Transaction[]): WeeklyExpenseHeatmap {
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
    expenses.forEach((t) => {
        const date = new Date(t.date);
        const dayIndex = date.getDay(); // 0 = Domingo, 6 = Sábado
        const category = getMainCategory(t);
        const categoryIndex = categories.indexOf(category);

        if (categoryIndex >= 0) {
            const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
            data[dayIndex][categoryIndex] += value;
        }
    });

    return { categories, days, data };
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
    let filteredTransactions = transactions;
    if (dateRange) {
        // Incluir todas as transações que:
        // 1. Foram criadas no período (transações não parceladas)
        // 2. OU são parceladas e podem ter parcelas vencendo no período
        filteredTransactions = transactions.filter((t) => {
            const transactionDate = new Date(t.date);
            
            // Se a transação está dentro do período, incluir
            if (transactionDate >= dateRange.from && transactionDate <= dateRange.to) {
                return true;
            }
            
            // Se é transação parcelada, verificar se alguma parcela vence no período
            const isCreditCard = t.payment_method === 'Cartão de Crédito' || 
                                t.payment_method === 'credit_card';
            const isInstallment = t.modality === 'installment' || 
                                 t.credit_card_charge?.charge.modality === 'installment';
            const installmentsCount = t.installments_count || 
                                     t.credit_card_charge?.charge.installments_count || 
                                     1;
            
            if (isCreditCard && isInstallment && installmentsCount > 1) {
                const purchaseDate = t.credit_card_charge?.charge.purchase_date 
                    ? new Date(t.credit_card_charge.charge.purchase_date)
                    : transactionDate;
                
                // Verificar se alguma parcela vence no período
                for (let i = 1; i <= installmentsCount; i++) {
                    const installmentMonth = addMonths(startOfMonth(purchaseDate), i);
                    const monthStart = startOfMonth(installmentMonth);
                    const monthEnd = endOfMonth(installmentMonth);
                    
                    if (monthStart <= dateRange.to && monthEnd >= dateRange.from) {
                        return true; // Esta parcela vence no período
                    }
                }
            }
            
            return false;
        });
    }

    return {
        summary: calculateSummary(filteredTransactions, dateRange, creditCardInvoicesTotal),
        monthly: groupByMonth(filteredTransactions, dateRange),
        categories: groupByCategory(filteredTransactions, dateRange),
        moneyFlow: generateMoneyFlow(filteredTransactions),
        heatmap: generateWeeklyHeatmap(filteredTransactions),
    };
}
