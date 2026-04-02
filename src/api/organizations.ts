// api/organizations.ts
import apiClient from './client';
import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  MyOrganizationsResponse,
  Organization,
  UpdateOrganizationRequest,
  OrganizationMembersResponse,
  CreateOrganizationInvitationsResponse,
  ListOrganizationInvitationsResponse,
  ResendOrganizationInvitationResponse,
} from './types';

/**
 * Cria uma nova organização (apenas owners)
 */
export const createOrganization = async (
  data: CreateOrganizationRequest
): Promise<CreateOrganizationResponse> => {
  const response = await apiClient.post<CreateOrganizationResponse>('/organizations', data);
  return response.data;
};

/**
 * Obtém os detalhes de uma organização
 */
export const getOrganization = async (
  orgId: string
): Promise<Organization> => {
  const response = await apiClient.get<Organization>(`/organizations/${orgId}`);
  return response.data;
};

/**
 * Atualiza campos de uma organização (partial update — envie apenas os campos a alterar)
 */
export const updateOrganization = async (
  orgId: string,
  data: UpdateOrganizationRequest
): Promise<Organization> => {
  const response = await apiClient.patch<Organization>(
    `/organizations/${orgId}`,
    data
  );
  return response.data;
};

/**
 * Lista todas as organizações do usuário atual
 */
export const getMyOrganizations = async (): Promise<MyOrganizationsResponse> => {
  const response = await apiClient.get<MyOrganizationsResponse>('/memberships/my-organizations');
  return response.data;
};

/**
 * Lista todos os membros de uma organização
 */
export const getOrganizationMembers = async (
  organizationId: string
): Promise<OrganizationMembersResponse> => {
  const response = await apiClient.get<OrganizationMembersResponse>(
    `/memberships/organizations/${organizationId}/members`
  );
  return response.data;
};

/**
 * Remove um membro de uma organização (apenas owners)
 */
export const removeMember = async (
  organizationId: string,
  userId: string
): Promise<void> => {
  await apiClient.delete(
    `/memberships/organizations/${organizationId}/members/${userId}`
  );
};

/**
 * Cria convites por e-mail para a organização (apenas owners)
 */
export const createOrganizationInvitations = async (
  organizationId: string,
  emails: string[]
): Promise<CreateOrganizationInvitationsResponse> => {
  const response = await apiClient.post<CreateOrganizationInvitationsResponse>(
    `/organizations/${organizationId}/invitations`,
    { emails }
  );
  return response.data;
};

/**
 * Lista convites da organização
 */
export const listOrganizationInvitations = async (
  organizationId: string
): Promise<ListOrganizationInvitationsResponse> => {
  const response = await apiClient.get<ListOrganizationInvitationsResponse>(
    `/organizations/${organizationId}/invitations`
  );
  return response.data;
};

/**
 * Reenvia um convite pendente
 */
export const resendOrganizationInvitation = async (
  organizationId: string,
  invitationId: string
): Promise<ResendOrganizationInvitationResponse> => {
  const response = await apiClient.post<ResendOrganizationInvitationResponse>(
    `/organizations/${organizationId}/invitations/${invitationId}/resend`
  );
  return response.data;
};

/**
 * Cancela um convite pendente
 */
export const cancelOrganizationInvitation = async (
  organizationId: string,
  invitationId: string
): Promise<void> => {
  await apiClient.delete(
    `/organizations/${organizationId}/invitations/${invitationId}`
  );
};
