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
