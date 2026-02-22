import { Link, useLocation } from 'wouter';
import { ChevronRight } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';

export function ConsultantBreadcrumb() {
  const [location] = useLocation();
  const { activeOrganization } = useOrganization();

  if (!location.startsWith('/consultant')) return null;

  const clientMatch = /^\/consultant\/clients\/([^/]+)(?:\/(.+))?/.exec(location);
  const isClientView = !!clientMatch;
  const subPath = clientMatch?.[2];

  const pageLabels: Record<string, string> = {
    transactions: 'Transações',
    'credit-cards': 'Cartões',
    'credit-cards/history': 'Histórico de Faturas',
    'credit-cards/planning': 'Planejamento',
    reports: 'Relatórios',
    goals: 'Metas',
  };
  const currentPageLabel = subPath ? pageLabels[subPath] ?? subPath : 'Dashboard';

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      {isClientView ? (
        <Link href="/consultant">
          <a className="hover:text-foreground transition-colors">Consultor</a>
        </Link>
      ) : (
        <span className="text-foreground font-medium">Consultor</span>
      )}
      {isClientView && (
        <>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <Link href={`/consultant/clients/${clientMatch![1]}`}>
            <a className="hover:text-foreground transition-colors truncate max-w-[180px]">
              {activeOrganization?.name ?? 'Cliente'}
            </a>
          </Link>
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span className="text-foreground font-medium truncate">{currentPageLabel}</span>
        </>
      )}
    </nav>
  );
}
