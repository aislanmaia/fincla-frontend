import { updateMyProfile } from "../../api/auth";
import { handleApiError } from "../../api/client";
import { createCreditCard } from "../../api/creditCards";
import {
  createOrganization,
  createOrganizationInvitations,
  getMyOrganizations,
  updateOrganization,
} from "../../api/organizations";
import { createRecurringSeries } from "../../api/recurringSeries";
import { createTag, listTags, listTagTypes, updateTag } from "../../api/tags";

export {
  createCreditCard,
  createOrganization,
  createOrganizationInvitations,
  createRecurringSeries,
  createTag,
  getMyOrganizations,
  listTags,
  listTagTypes,
  updateMyProfile,
  updateOrganization,
  updateTag,
};

export function formatOnboardingApiError(error) {
  return handleApiError(error);
}
