import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConsultantClient } from '@/types/api';

interface ConsultantClientListProps {
  clients: ConsultantClient[];
  isLoading?: boolean;
}

export function ConsultantClientList({ clients, isLoading }: ConsultantClientListProps) {
  if (isLoading) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0">
        <h3 className="text-lg font-semibold mb-4">Clientes</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="p-6 rounded-2xl shadow-flat border-0">
        <h3 className="text-lg font-semibold mb-4">Clientes</h3>
        <p className="text-sm text-muted-foreground">Nenhum cliente vinculado.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-2xl shadow-flat border-0">
      <h3 className="text-lg font-semibold mb-4">Clientes ({clients.length})</h3>
      <div className="space-y-2">
        {clients.map((client) => (
          <Link
            key={client.organization_id}
            href={`/consultant/clients/${client.organization_id}`}
          >
            <a
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              aria-label={`Ver detalhes de ${client.organization_name}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{client.organization_name}</p>
                <p className="text-sm text-muted-foreground">
                  {client.role === 'owner' ? 'Proprietário' : 'Membro'} · desde{' '}
                  {format(new Date(client.membership_created_at), "dd 'de' MMM yyyy", {
                    locale: ptBR,
                  })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" aria-hidden />
            </a>
          </Link>
        ))}
      </div>
    </Card>
  );
}
