import { PropsWithChildren, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { isConsultant } from '@/lib/consultant';

/**
 * Guard que verifica se o usuário possui pelo menos uma organização.
 *
 * Comportamento:
 * - Consultor sem organização → Redireciona para /consultant (acessa área consolidada)
 * - Owner sem organização → Redireciona para /onboarding/create-organization
 * - Member sem organização → Redireciona para /no-organization
 * - Usuário com organização → Permite acesso ao conteúdo
 */
export function RequireOrganization({ children }: PropsWithChildren) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { organizations, isLoading } = useOrganization();

  useEffect(() => {
    if (isLoading || !user) return;

    if (organizations.length === 0) {
      if (isConsultant(user)) {
        setLocation('/consultant');
      } else if (user.role === 'owner') {
        setLocation('/onboarding/create-organization');
      } else {
        setLocation('/no-organization');
      }
    }
  }, [organizations, isLoading, user, setLocation]);

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#00C6B8]/30 border-t-[#00A89C] rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Verificando organizações...</p>
        </div>
      </div>
    );
  }

  if (organizations.length > 0 || isConsultant(user)) {
    return <>{children}</>;
  }

  return null;
}




