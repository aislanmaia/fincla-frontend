import { describe, expect, it } from "vitest";
import {
  buildSessionAfterOnboarding,
  isOnboardingRequired,
} from "../sessionState.js";

describe("sessionState", () => {
  it("não exige onboarding quando o usuário já foi marcado como concluído", () => {
    expect(isOnboardingRequired({
      isAuthenticated: true,
      isBootstrapping: false,
      organizations: [],
      user: { onboarding_completed: true },
    })).toBe(false);
  });

  it("exige onboarding quando a flag está false mesmo com organização existente", () => {
    expect(isOnboardingRequired({
      isAuthenticated: true,
      isBootstrapping: false,
      organizations: [
        {
          organization: { id: "org-1", name: "Casa", org_type: "couple" },
        },
      ],
      user: { onboarding_completed: false },
    })).toBe(true);
  });

  it("usa a organização criada como fallback ao concluir onboarding", () => {
    expect(buildSessionAfterOnboarding({
      currentSession: {
        isAuthenticated: true,
        isBootstrapping: false,
        isLoading: false,
        error: "",
        activeOrgId: null,
        organizations: [],
        user: { id: "u1", onboarding_completed: false },
      },
      onboardingResult: {
        activeOrgId: "org-1",
        organization: { id: "org-1", name: "Nova Org", org_type: "couple" },
        organizations: [],
      },
    })).toMatchObject({
      activeOrgId: "org-1",
      organizations: [
        {
          organization: { id: "org-1", name: "Nova Org", org_type: "couple" },
        },
      ],
      user: { onboarding_completed: true },
    });
  });
});
