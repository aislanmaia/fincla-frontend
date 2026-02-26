import type { User } from '@/types/api';
import { isConsultant } from '@/lib/consultant';

export const CONSULTANT_403_KEY = 'consultant_403';

export type Permission = 'consultant';

const PERMISSION_CHECKS: Record<
  Permission,
  (user: User | null | undefined) => boolean
> = {
  consultant: (user) => {
    if (!isConsultant(user)) return false;
    if (sessionStorage.getItem(CONSULTANT_403_KEY)) return false;
    return true;
  },
};

export function canAccess(
  permission: Permission,
  user: User | null | undefined
): boolean {
  const check = PERMISSION_CHECKS[permission];
  if (!check) return false;
  return check(user);
}
