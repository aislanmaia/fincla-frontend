// api/organizations.ts
import apiClient from './client';
import { CreateOrganizationRequest, CreateOrganizationResponse, MyOrganizationsResponse } from '../types/api';

/**
 * Cria uma nova organização
 */
export const createOrganization = async (
  data: CreateOrganizationRequest
): Promise<CreateOrganizationResponse> => {
  const response = await apiClient.post<CreateOrganizationResponse>('/organizations', data);
  return response.data;
};

/**
 * Lista todas as organizações do usuário atual
 */
export const getMyOrganizations = async (): Promise<MyOrganizationsResponse> => {
  const response = await apiClient.get<MyOrganizationsResponse>('/memberships/my-organizations');
  return response.data;
};
