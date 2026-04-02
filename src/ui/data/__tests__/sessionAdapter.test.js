import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserApi: vi.fn(),
  getMyProfileApi: vi.fn(),
  isAuthenticatedApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  getMyOrganizationsApi: vi.fn(),
}));

vi.mock("../../../api/auth", () => ({
  getCurrentUser: mocks.getCurrentUserApi,
  getMyProfile: mocks.getMyProfileApi,
  isAuthenticated: mocks.isAuthenticatedApi,
  login: mocks.loginApi,
  logout: mocks.logoutApi,
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("../../../api/organizations", () => ({
  getMyOrganizations: mocks.getMyOrganizationsApi,
}));

vi.mock("../../../api/client", () => ({
  handleApiError: vi.fn((error) => String(error)),
}));

import { getCurrentUser } from "../sessionAdapter.js";

describe("sessionAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca o perfil completo do usuário para reidratar onboarding no bootstrap", async () => {
    const profile = {
      id: "user-1",
      email: "owner@example.com",
      onboarding_completed: true,
    };
    mocks.getMyProfileApi.mockResolvedValue(profile);

    await expect(getCurrentUser()).resolves.toEqual(profile);
    expect(mocks.getMyProfileApi).toHaveBeenCalledTimes(1);
    expect(mocks.getCurrentUserApi).not.toHaveBeenCalled();
  });
});
