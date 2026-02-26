import type { User } from '@/types/api';

export function isConsultant(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'consultant';
}
