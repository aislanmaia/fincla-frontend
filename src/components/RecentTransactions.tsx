import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { 
  ShoppingCart, 
  Building, 
  ArrowRightLeft, 
  PiggyBank,
  ArrowUpRight,
  Plus, 
  FileText 
} from 'lucide-react';
import { Transaction } from '@/hooks/useFinancialData';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, memo } from 'react';
import { NewTransactionSheet } from './NewTransactionSheet';

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export const RecentTransactions = memo(function RecentTransactions({ transactions, isLoading }: RecentTransactionsProps) {
  const getTransactionIcon = (iconName: string, isExpense: boolean, category: string) => {
    // Mapear baseado no tipo e categoria para cores específicas
    const iconMap: Record<string, any> = {
      'shopping-cart': ShoppingCart,
      'building': Building,
      'car': ShoppingCart,
      'gas-pump': ShoppingCart,
      'heart': ShoppingCart,
      'coffee': ShoppingCart,
      'shopping-bag': ShoppingCart,
      'dollar-sign': Building,
    };

    // Para transferências, usar ícone específico
    if (category?.toLowerCase().includes('transferência') || category?.toLowerCase().includes('pagamento')) {
      return ArrowRightLeft;
    }

    // Para investimentos/poupança
    if (category?.toLowerCase().includes('investimento') || category?.toLowerCase().includes('poupança')) {
      return PiggyBank;
    }

    const Icon = iconMap[iconName] || (isExpense ? ShoppingCart : Building);
    return Icon;
  };

  const getIconColor = (isExpense: boolean, category: string) => {
    // Verde para entradas/bônus
    if (!isExpense) {
      return {
        bg: '#10B981', // Verde
        icon: '#FFFFFF', // Ícone branco
      };
    }

    // Azul para transferências/pagamentos
    if (category?.toLowerCase().includes('transferência') || category?.toLowerCase().includes('pagamento')) {
      return {
        bg: '#3B82F6', // Azul
        icon: '#FFFFFF',
      };
    }

    // Amarelo para investimentos/poupança
    if (category?.toLowerCase().includes('investimento') || category?.toLowerCase().includes('poupança')) {
      return {
        bg: '#F59E0B', // Amarelo/Dourado
        icon: '#FFFFFF',
      };
    }

    // Vermelho para despesas
    return {
      bg: '#EF4444', // Vermelho
      icon: '#FFFFFF',
    };
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoje';
    } else if (diffDays === 1) {
      return 'Ontem';
    } else {
      return `${diffDays} dias atrás`;
    }
  };

  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-white rounded-2xl shadow-flat border-0 p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-28 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0">
              <div className="w-12 h-12 shrink-0 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex flex-col grow shrink items-start text-left min-w-0">
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mt-1" />
              </div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <>
        <Card className="bg-white rounded-2xl shadow-flat border-0 p-4 md:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Transações Recentes</h3>
            <Link href="/transactions">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 h-auto text-sm font-medium flex items-center gap-1.5"
              >
                Ver todas
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="bg-gray-100 p-4 rounded-full">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 mb-1">Nenhuma transação encontrada</p>
              <p className="text-xs text-gray-500 mb-4">Comece adicionando sua primeira transação</p>
              <Button
                onClick={() => setIsNewTransactionOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Transação
              </Button>
            </div>
          </div>
        </Card>
        <NewTransactionSheet
          open={isNewTransactionOpen}
          onOpenChange={setIsNewTransactionOpen}
        />
      </>
    );
  }

  return (
    <>
      <Card className="bg-white rounded-2xl shadow-flat border-0 p-4 md:p-6 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Transações Recentes</h3>
          <Link href="/transactions">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 h-auto text-sm font-medium flex items-center gap-1.5"
            >
              Ver todas
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <div className="flex flex-col gap-4">
            {transactions.slice(0, 6).map((transaction, idx) => {
              const isExpense = transaction.amount < 0;
              const amount = Math.abs(transaction.amount);
              const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              const Icon = getTransactionIcon(transaction.icon, isExpense, transaction.category);
              const iconColors = getIconColor(isExpense, transaction.category);

              return (
                <div 
                  key={transaction.id}
                  className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0"
                >
                  {/* Filho 1: Ícone - Fixo, Inflexível */}
                  <div 
                    className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: iconColors.bg }}
                  >
                    <Icon 
                      className="w-6 h-6"
                      style={{ color: iconColors.icon }}
                      strokeWidth={2}
                    />
                  </div>

                  {/* Filho 2: Bloco Central de Texto - Flexível, Alinhado à Esquerda */}
                  <div className="flex flex-col grow shrink items-start text-left min-w-0">
                    {/* Título */}
                    <p className="font-bold text-gray-900 truncate w-full">
                      {transaction.description}
                    </p>
                    
                    {/* Categoria - Badge inline-block, permite quebra de texto */}
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 text-wrap">
                      {transaction.category}
                    </span>
                    
                    {/* Data */}
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(transaction.date)}
                    </p>
                  </div>

                  {/* Filho 3: Valor - Fixo, Inflexível */}
                  <div className="text-right font-bold text-lg shrink-0 whitespace-nowrap">
                    <span
                      className={cn(
                        isExpense ? 'text-red-500' : 'text-green-500'
                      )}
                    >
                      {isExpense ? '-' : '+'}R$ {formattedAmount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <NewTransactionSheet
        open={isNewTransactionOpen}
        onOpenChange={setIsNewTransactionOpen}
      />
    </>
  );
});
