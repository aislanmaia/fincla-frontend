// api/organizations.ts
//
// `monthly_income` — a renda declarada da organização — chega na forma canônica
// `{amount, currency}` (fincla-api#134). Ela viajava ao lado de `base_currency` como
// campo IRMÃO, que é a forma que o ADR-0002 proíbe: `total += monthly_income` nunca
// esbarra em `base_currency`. `unwrapMoney` desembrulha as quatro rotas que devolvem
// a organização, inclusive a de dentro de `/memberships/my-organizations`, que é a
// primeira chamada que o app faz depois do login.
import apiClient from './client';
import { unwrapMoney } from './money';
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
  return unwrapMoney(response.data);
};

/**
 * Obtém os detalhes de uma organização
 */
export const getOrganization = async (
  orgId: string
): Promise<Organization> => {
  const response = await apiClient.get<Organization>(`/organizations/${orgId}`);
  return unwrapMoney(response.data);
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
  return unwrapMoney(response.data);
};

/**
 * Lista todas as organizações do usuário atual
 */
export const getMyOrganizations = async (): Promise<MyOrganizationsResponse> => {
  const response = await apiClient.get<MyOrganizationsResponse>('/memberships/my-organizations');
  return unwrapMoney(response.data);
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
