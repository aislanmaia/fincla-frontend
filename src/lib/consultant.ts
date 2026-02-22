import type { User } from '@/types/api';

const CONSULTANT_FEATURES = [
  'multi_org_dashboard',
  'client_list',
  'consolidated_reports',
] as const;

export function isConsultant(user: User | null | undefined): boolean {
  if (!user?.subscription?.features?.length) return false;
  return CONSULTANT_FEATURES.some((f) =>
    user.subscription!.features!.includes(f)
  );
}
