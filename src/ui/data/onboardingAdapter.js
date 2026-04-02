import { updateMyProfile } from "../../api/auth";
import { handleApiError } from "../../api/client";
import { createCreditCard } from "../../api/creditCards";
import {
  createOrganization,
  createOrganizationInvitations,
  getMyOrganizations,
  updateOrganization,
} from "../../api/organizations";
import { createRecurringTransaction } from "../../api/recurringTransactions";
import { createTag, listTags, listTagTypes, updateTag } from "../../api/tags";

export {
  createCreditCard,
  createOrganization,
  createOrganizationInvitations,
  createRecurringTransaction,
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
