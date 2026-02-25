import { useAuth } from '@/hooks/useAuth';
import { canAccess, type Permission } from '@/lib/permissions';

export function useCanAccess(permission: Permission): boolean {
  const { user } = useAuth();
  return canAccess(permission, user);
}
