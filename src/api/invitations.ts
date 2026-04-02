// api/invitations.ts
import apiClient from './client';
import type { AcceptInvitationRequest, AcceptInvitationResponse } from './types';

/**
 * Aceita convite de organização (público; token vem do e-mail).
 */
export const acceptInvitation = async (
  data: AcceptInvitationRequest
): Promise<AcceptInvitationResponse> => {
  const response = await apiClient.post<AcceptInvitationResponse>(
    '/invitations/accept',
    data
  );
  return response.data;
};
