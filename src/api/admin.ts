import apiClient from './client';

export interface AdminIdentity {
  id: string;
  email: string;
  is_admin: true;
}

export async function getAdminMe(): Promise<AdminIdentity> {
  const response = await apiClient.get<AdminIdentity>('/admin/me');
  return response.data;
}

export interface AdminOverview {
  accounts: number;
  organizations: number;
  paid_active: number;
  past_due: number;
  blocked_accounts: number;
  password_pending: number;
  beta_active: number;
  courtesy_active: number;
  pending_plan_changes: number;
  coupon_reprice_due: number;
  coupons_active: number;
  recent_accounts: AdminUser[];
}

export const getAdminOverview = async () =>
  (await apiClient.get<AdminOverview>('/admin/overview')).data;

export interface AdminPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminSubscription {
  id: string;
  plan: string;
  status: string;
  billing_cycle: string;
  gateway_provider: string;
  gateway_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  beta_enabled: boolean;
  courtesy_plan: string | null;
  courtesy_until: string | null;
  coupon_id: string | null;
  coupon_discounted_charges: number | null;
  coupon_reprice_due: boolean;
  coupon_repriced_at: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  password_pending: boolean;
  blocked_at: string | null;
  subscription: AdminSubscription | null;
}

export interface AdminOrganization {
  id: string;
  name: string;
  org_type: string | null;
  created_at: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  audience: string;
  monthly_price_cents: number;
  yearly_price_cents: number | null;
  max_organizations: number;
  max_users_per_org: number;
  features: string[];
  is_active: boolean;
  is_public: boolean;
}

export const getAdminUsers = async (params: { q?: string; status?: string; flag?: string; limit?: number; offset?: number }) =>
  (await apiClient.get<AdminPage<AdminUser>>('/admin/users', { params })).data;

export const getAdminUser = async (id: string) =>
  (await apiClient.get<AdminUser & { organizations: Array<{ id: string; name: string; role: string }>; invoices: Array<{ id: string; amount_cents: number; currency: string; status: string; due_date: string; invoice_url: string | null }> }>(`/admin/users/${id}`)).data;

export const getAdminOrganizations = async (params: { q?: string; limit?: number; offset?: number }) =>
  (await apiClient.get<AdminPage<AdminOrganization>>('/admin/organizations', { params })).data;

export const getAdminOrganization = async (id: string) =>
  (await apiClient.get<AdminOrganization & { members: Array<{ id: string; email: string; first_name: string | null; last_name: string | null; role: string }> }>(`/admin/organizations/${id}`)).data;

export const getAdminPlans = async () =>
  (await apiClient.get<{ items: AdminPlan[] }>('/admin/plans')).data;

export const changeAdminUserAccess = async (id: string, action: 'block' | 'unblock', reason: string) =>
  (await apiClient.post<{ blocked_at: string | null; audit_event_id: string }>(`/admin/users/${id}/${action}`, { reason })).data;

export const getAdminUserAudit = async (id: string) =>
  (await apiClient.get<{ items: Array<{ id: string; actor_user_id: string; action: string; reason: string; created_at: string }> }>(`/admin/users/${id}/audit`)).data;

export const createAdminAccount = async (data: { email: string; first_name: string; last_name?: string; organization_name: string; organization_type?: string; monthly_income?: string }) =>
  (await apiClient.post<{ user_id: string; organization_id: string; email_sent: boolean }>('/admin/users', data)).data;

export const sendAdminPasswordReset = async (id: string, reason: string) =>
  (await apiClient.post<{ email_sent: boolean }>(`/admin/users/${id}/password-reset-email`, { reason })).data;

export const changeAdminBeta = async (id: string, enabled: boolean, reason: string) =>
  (await apiClient.post(`/admin/users/${id}/beta${enabled ? '' : '/end'}`, { reason })).data;

export const grantAdminCourtesy = async (id: string, plan: string, expires_at: string, reason: string) =>
  (await apiClient.post(`/admin/users/${id}/courtesy`, { plan, expires_at, reason })).data;

export const endAdminCourtesy = async (id: string, reason: string) =>
  (await apiClient.post(`/admin/users/${id}/courtesy/end`, { reason })).data;

export interface AdminPlanChangeRequest {
  id: string;
  current_plan: string;
  target_plan: string;
  target_cycle: 'monthly' | 'yearly';
  state: string;
  reason: string;
  created_at: string;
}

export const getAdminPlanRequests = async (id: string) =>
  (await apiClient.get<{ items: AdminPlanChangeRequest[] }>(`/admin/users/${id}/plan-change-requests`)).data;

export const requestAdminPlanChange = async (id: string, target_plan: string, target_cycle: 'monthly' | 'yearly', reason: string) =>
  (await apiClient.post<AdminPlanChangeRequest>(`/admin/users/${id}/plan-change-requests`, { target_plan, target_cycle, reason })).data;

export const withdrawAdminPlanChange = async (id: string, requestId: string, reason: string) =>
  (await apiClient.post<AdminPlanChangeRequest>(`/admin/users/${id}/plan-change-requests/${requestId}/withdraw`, { reason })).data;

export const cancelAdminRenewal = async (id: string, reason: string) =>
  (await apiClient.post<{ status: string; cancel_at_period_end: boolean; effective_until: string }>(`/admin/users/${id}/cancel-renewal`, { reason })).data;

export interface AdminCoupon {
  id: string;
  code: string;
  percent_off: number;
  eligible_plans: Array<'pro' | 'consultant_pro'>;
  eligible_cycles: Array<'monthly' | 'yearly'>;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  uses: number;
  discounted_charges: number;
  is_active: boolean;
}

export type AdminCouponInput = Omit<AdminCoupon, 'id' | 'uses' | 'is_active'> & { reason: string };

export const getAdminCoupons = async () =>
  (await apiClient.get<{ items: AdminCoupon[] }>('/admin/coupons')).data;

export const createAdminCoupon = async (body: AdminCouponInput) =>
  (await apiClient.post<AdminCoupon>('/admin/coupons', body)).data;

export const disableAdminCoupon = async (id: string, reason: string) =>
  (await apiClient.post<AdminCoupon>(`/admin/coupons/${id}/disable`, { reason })).data;

export const retryAdminCouponReprice = async (userId: string, reason: string) =>
  (await apiClient.post<{ completed: number; failed: number }>(`/admin/users/${userId}/retry-coupon-reprice`, { reason })).data;
