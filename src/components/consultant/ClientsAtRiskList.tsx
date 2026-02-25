import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConsultantEmptyState } from '@/components/consultant/ConsultantEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { ClientsAtRiskResponse } from '@/types/api';

interface ClientsAtRiskListProps {
  data?: ClientsAtRiskResponse;
  isLoading?: boolean;
}

export function ClientsAtRiskList({ data, isLoading }: ClientsAtRiskListProps) {
  
  // Get risk level color based on score
  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Get risk level bg color
  const getRiskBgColor = (score: number) => {
    if (score >= 70) return 'bg-red-500/10';
    if (score >= 40) return 'bg-yellow-500/10';
    return 'bg-green-500/10';
  };

  // Get invoice status icon
  const getInvoiceStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unpaid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Clientes em Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.clients.length === 0) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            Clientes em Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConsultantEmptyState
            icon={CheckCircle}
            title="Nenhum cliente em risco"
            description="Ótimo! Todos os seus clientes estão com a saúde financeira em dia no momento."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Clientes em Risco
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({data.total} {data.total === 1 ? 'cliente' : 'clientes'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.clients.map((client) => (
            <div
              key={client.organization_id}
              className={`flex items-center justify-between p-4 rounded-lg ${getRiskBgColor(client.risk_score)} border border-border/50`}
            >
              <div className="flex items-center gap-4">
                <div className={`text-2xl font-bold ${getRiskColor(client.risk_score)}`}>
                  {client.risk_score}
                </div>
                <div>
                  <p className="font-medium">{client.organization_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.main_situation}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`font-medium ${client.current_balance < 0 ? 'text-red-500' : ''}`}>
                    {formatCurrency(client.current_balance)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Fatura:</span>
                  {getInvoiceStatusIcon(client.last_invoice_status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
