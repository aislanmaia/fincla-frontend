import { handleApiError } from "../../api/client";
import {
  cancelOrganizationInvitation,
  createOrganizationInvitations,
  getOrganizationMembers,
  listOrganizationInvitations,
  removeMember,
  resendOrganizationInvitation,
} from "../../api/organizations";

export {
  cancelOrganizationInvitation,
  createOrganizationInvitations,
  getOrganizationMembers,
  listOrganizationInvitations,
  removeMember,
  resendOrganizationInvitation,
};

export function formatOrganizationsApiError(error) {
  return handleApiError(error);
}
