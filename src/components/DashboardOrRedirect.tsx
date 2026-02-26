import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { isConsultant } from '@/lib/consultant';
import { CONSULTANT_403_KEY } from '@/lib/permissions';
import Dashboard from '@/pages/dashboard';

export function DashboardOrRedirect() {
  const { user } = useAuth();

  if (isConsultant(user)) {
    if (sessionStorage.getItem(CONSULTANT_403_KEY)) {
      sessionStorage.removeItem(CONSULTANT_403_KEY);
      return <Redirect to="/transactions" />;
    }
    return <Redirect to="/consultant" />;
  }

  return <Dashboard />;
}
