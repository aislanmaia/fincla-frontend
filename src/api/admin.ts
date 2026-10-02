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
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
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

export const getAdminUsers = async (params: { q?: string; status?: string; limit?: number; offset?: number }) =>
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
