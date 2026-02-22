import Dashboard from '@/pages/dashboard';

/**
 * Wrapper para a rota base do cliente do consultor.
 * useOrganization já prioriza organizationId da URL, então o Dashboard funciona normalmente.
 * Breadcrumb será adicionado em Task 7.
 */
export function ConsultantClientLayout() {
  return <Dashboard />;
}
