// lib/analytics.ts
// Processa transações do backend para gerar analytics no frontend

import { Transaction } from '@/types/api';
import { generateDistinctCategoryColors } from './colorGenerator';

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
 * Processa transações para gerar resumo financeiro
 * @param transactions - Lista de transações
 * @param dateRange - Opcional: range de datas para filtrar transações
 */
export function calculateSummary(
    transactions: Transaction[],
    dateRange?: { from: Date; to: Date }
): FinancialSummary {
    // Filtrar por data se fornecido
    let filteredTransactions = transactions;
    if (dateRange) {
        filteredTransactions = transactions.filter((t) => {
            const transactionDate = new Date(t.date);
            return transactionDate >= dateRange.from && transactionDate <= dateRange.to;
        });
    }

    const income = filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((acc, t) => {
            const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
            return acc + value;
        }, 0);

    const expenses = filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((acc, t) => {
            const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
            return acc + value;
        }, 0);

    const balance = income - expenses;

    return {
        balance,
        income,
        expenses,
    };
}

/**
 * Agrupa transações por mês para gráfico temporal
 */
export function groupByMonth(transactions: Transaction[]): MonthlyData[] {
    const monthMap = new Map<string, { income: number; expenses: number }>();

    transactions.forEach((t) => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });

        if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { income: 0, expenses: 0 });
        }

        const data = monthMap.get(monthKey)!;
        // IMPORTANTE: Converter para número pois o backend pode retornar como string
        const numericValue = typeof t.value === 'string' ? parseFloat(t.value) : t.value;

        if (t.type === 'income') {
            data.income += numericValue;
        } else {
            data.expenses += numericValue;
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
 */
export function groupByCategory(transactions: Transaction[]): ExpenseCategory[] {
    const categoryMap = new Map<string, number>();

    // Filtrar apenas despesas
    const expenses = transactions.filter((t) => t.type === 'expense');

    expenses.forEach((t) => {
        const category = getMainCategory(t);
        const current = categoryMap.get(category) || 0;
        const value = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
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
    dateRange?: { from: Date; to: Date }
) {
    // Filtrar por data se fornecido
    let filteredTransactions = transactions;
    if (dateRange) {
        filteredTransactions = transactions.filter((t) => {
            const transactionDate = new Date(t.date);
            return transactionDate >= dateRange.from && transactionDate <= dateRange.to;
        });
    }

    return {
        summary: calculateSummary(filteredTransactions),
        monthly: groupByMonth(filteredTransactions),
        categories: groupByCategory(filteredTransactions),
        moneyFlow: generateMoneyFlow(filteredTransactions),
        heatmap: generateWeeklyHeatmap(filteredTransactions),
    };
}
