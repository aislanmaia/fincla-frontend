import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { isAxiosError } from 'axios';
import { useConsultantClients } from '@/hooks/useConsultantData';
import { ConsultantClientList } from '@/components/consultant/ConsultantClientList';
import { PageTransition } from '@/components/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { CONSULTANT_403_KEY } from '@/lib/permissions';
import { handleApiError } from '@/api/client';

export default function ConsultantClientsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const errorHandledRef = useRef(false);

  const { data: clientsData, isLoading, error } = useConsultantClients();
  const clients = clientsData?.clients ?? [];

  useEffect(() => {
    if (!error) {
      errorHandledRef.current = false;
      return;
    }
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    const status = isAxiosError(error) ? error.response?.status : null;
    if (status === 403) {
      sessionStorage.setItem(CONSULTANT_403_KEY, '1');
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar a área do consultor.',
        variant: 'destructive',
      });
      setLocation('/');
    } else {
      toast({
        title: 'Erro ao carregar clientes',
        description: handleApiError(error),
        variant: 'destructive',
      });
    }
  }, [error, toast, setLocation]);

  return (
    <PageTransition>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl xl:max-w-[95%] 2xl:max-w-[1800px]">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Meus Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e acompanhe os clientes vinculados à sua conta.
          </p>
        </div>
        <ConsultantClientList clients={clients} isLoading={isLoading} />
      </div>
    </PageTransition>
  );
}
