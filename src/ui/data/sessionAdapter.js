import {
  forgotPassword,
  getMyProfile,
  isAuthenticated,
  login as loginRequest,
  logout as logoutRequest,
  resetPassword as resetPasswordWithTokenRequest,
} from "../../api/auth";
import { handleApiError } from "../../api/client";
import { getMyOrganizations } from "../../api/organizations";

export async function getCurrentUser() {
  return getMyProfile();
}

export {
  isAuthenticated,
  getMyOrganizations,
};

export const login = loginRequest;
export const logout = logoutRequest;

export const requestPasswordReset = forgotPassword;
export const resetPasswordWithToken = resetPasswordWithTokenRequest;

export function formatSessionApiError(error) {
  return handleApiError(error);
}
