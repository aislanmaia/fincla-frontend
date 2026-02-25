import { type PropsWithChildren } from 'react';
import { useCanAccess } from '@/hooks/useCanAccess';
import type { Permission } from '@/lib/permissions';

interface PermissionGateProps extends PropsWithChildren {
  permission: Permission;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const hasAccess = useCanAccess(permission);
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
