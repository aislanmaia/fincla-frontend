import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatSessionApiError,
  getCurrentUser,
  getMyOrganizations,
  isAuthenticated,
  login as loginApi,
  logout as logoutApi,
  requestPasswordReset as requestPasswordResetApi,
  resetPasswordWithToken as resetPasswordWithTokenApi,
} from "../../data/sessionAdapter";
import {
  buildSessionAfterOnboarding,
  isOnboardingRequired,
} from "./sessionState.js";
import { clearAllEvaluations } from "../consultant/clientEvaluationStore.js";
import { clearPostLoginRedirect } from "../../routing/postLoginRedirect.js";

const ACTIVE_ORG_KEY = "fincla_active_org_id";

const EMPTY_SESSION = {
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  error: "",
  user: null,
  organizations: [],
  activeOrgId: null,
};

function readStoredActiveOrgId() {
  return window.localStorage.getItem(ACTIVE_ORG_KEY);
}

function persistActiveOrgId(orgId) {
  if (orgId) {
    window.localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_ORG_KEY);
}

function pickActiveOrgId(organizations) {
  if (!organizations.length) return null;

  const storedOrgId = readStoredActiveOrgId();
  const stillExists = organizations.some(
    (item) => item.organization.id === storedOrgId,
  );

  return stillExists ? storedOrgId : organizations[0].organization.id;
}

export function useSession() {
  const [session, setSession] = useState(EMPTY_SESSION);

  // Todo fim de sessão passa por aqui — logout, token expirado e falha de
  // bootstrap. É o único ponto por onde dá para garantir que nada de um usuário
  // sobrevive para o próximo.
  const resetSession = useCallback((next = {}) => {
    // As avaliações de IA do consultor vivem num store de módulo (fora do React,
    // para a run sobreviver ao fechamento do painel). Sair da conta não recarrega
    // a página, então esse store atravessaria o logout: o próximo consultor a
    // entrar nesta aba veria a análise que o anterior mandou gerar.
    clearAllEvaluations();
    setSession({
      ...EMPTY_SESSION,
      isBootstrapping: false,
      ...next,
    });
  }, []);

  const bootstrap = useCallback(async () => {
    if (!isAuthenticated()) {
      persistActiveOrgId(null);
      resetSession();
      return null;
    }

    setSession((current) => ({
      ...current,
      isBootstrapping: true,
      isLoading: true,
      error: "",
    }));

    try {
      const [user, orgResponse] = await Promise.all([
        getCurrentUser(),
        getMyOrganizations(),
      ]);

      const organizations = orgResponse.organizations ?? [];
      const activeOrgId = pickActiveOrgId(organizations);

      persistActiveOrgId(activeOrgId);

      const nextSession = {
        isAuthenticated: true,
        isBootstrapping: false,
        isLoading: false,
        error: "",
        user,
        organizations,
        activeOrgId,
      };

      setSession(nextSession);
      return nextSession;
    } catch (error) {
      logoutApi();
      persistActiveOrgId(null);
      resetSession({ error: formatSessionApiError(error) });
      return null;
    }
  }, [resetSession]);

  useEffect(() => {
    bootstrap();

    const handleAuthExpired = () => {
      resetSession({
        error: "Sua sessao expirou. Entre novamente para continuar.",
      });
    };

    window.addEventListener("fincla:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("fincla:auth-expired", handleAuthExpired);
    };
  }, [bootstrap, resetSession]);

  const signIn = useCallback(
    async (email, password) => {
      setSession((current) => ({
        ...current,
        isLoading: true,
        error: "",
      }));

      try {
        await loginApi(email, password);
        const nextSession = await bootstrap();

        if (!nextSession) {
          throw new Error("Nao foi possivel carregar sua sessao.");
        }

        return nextSession;
      } catch (error) {
        const message = formatSessionApiError(error);

        setSession((current) => ({
          ...current,
          isLoading: false,
          isBootstrapping: false,
          isAuthenticated: false,
          error: message,
        }));

        throw new Error(message);
      }
    },
    [bootstrap],
  );

  const signOut = useCallback(() => {
    logoutApi();
    persistActiveOrgId(null);
    clearPostLoginRedirect();
    resetSession();
  }, [resetSession]);

  const requestPasswordReset = useCallback(async (email) => {
    try {
      await requestPasswordResetApi(email);
    } catch (error) {
      throw new Error(formatSessionApiError(error));
    }
  }, []);

  const resetPasswordWithToken = useCallback(async (token, newPassword) => {
    try {
      await resetPasswordWithTokenApi(token, newPassword);
    } catch (error) {
      throw new Error(formatSessionApiError(error));
    }
  }, []);

  const setActiveOrganization = useCallback((orgId) => {
    persistActiveOrgId(orgId);
    setSession((current) => ({
      ...current,
      activeOrgId: orgId,
    }));
  }, []);

  const completeOnboarding = useCallback((onboardingResult) => {
    const nextSession = buildSessionAfterOnboarding({
      currentSession: session,
      onboardingResult,
    });
    persistActiveOrgId(nextSession.activeOrgId);
    setSession(nextSession);
    return nextSession;
  }, [session]);

  const onboardingRequired = useMemo(() => isOnboardingRequired(session), [session]);

  return {
    ...session,
    onboardingRequired,
    bootstrap,
    completeOnboarding,
    signIn,
    signOut,
    requestPasswordReset,
    resetPasswordWithToken,
    setActiveOrganization,
  };
}
