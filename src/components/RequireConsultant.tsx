import { type PropsWithChildren } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/lib/permissions';

export function RequireConsultant({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { user, loading } = useAuth();

  // Wait for auth to load before checking permissions
  if (loading) {
    return null;
  }

  if (location.startsWith('/consultant') && !canAccess('consultant', user)) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
