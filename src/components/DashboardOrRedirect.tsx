import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { isConsultant } from '@/lib/consultant';
import Dashboard from '@/pages/dashboard';

export function DashboardOrRedirect() {
  const { user } = useAuth();

  if (isConsultant(user)) {
    return <Redirect to="/consultant" />;
  }

  return <Dashboard />;
}
