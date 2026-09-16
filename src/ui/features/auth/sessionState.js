import { checkoutPersona } from "./checkoutIdentity.js";

export function isOnboardingRequired(session) {
  if (!session.isAuthenticated || session.isBootstrapping) return false;
  if (session.user?.onboarding_completed || checkoutPersona(session.user) === "consultant") return false;
  return true;
}

export function buildSessionAfterOnboarding({ currentSession, onboardingResult }) {
  const organizations = onboardingResult.organizations?.length
    ? onboardingResult.organizations
    : [{ organization: onboardingResult.organization }];

  return {
    ...currentSession,
    isAuthenticated: true,
    isBootstrapping: false,
    isLoading: false,
    error: "",
    activeOrgId: onboardingResult.activeOrgId,
    organizations,
    user: {
      ...(currentSession.user || {}),
      onboarding_completed: true,
    },
  };
}
