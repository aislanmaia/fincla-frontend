import { handleApiError } from "../../api/client";
import { acceptInvitation } from "../../api/invitations";

export async function acceptOrganizationInvitation(payload) {
  return acceptInvitation(payload);
}

export function formatInvitationApiError(error) {
  return handleApiError(error);
}
