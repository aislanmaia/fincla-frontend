import type { User } from '@/types/api';

const CONSULTANT_FEATURES = [
  'multi_org_dashboard',
  'client_list',
  'consolidated_reports',
] as const;

const NON_CONSULTANT_EMAILS = ['demo@fincla.com.app'];

export function isConsultant(user: User | null | undefined): boolean {
  if (!user?.subscription?.features?.length) return false;
  const email = user.email?.toLowerCase().trim();
  if (email && NON_CONSULTANT_EMAILS.some((e) => e.toLowerCase() === email)) {
    return false;
  }
  return CONSULTANT_FEATURES.some((f) =>
    user.subscription!.features!.includes(f)
  );
}
