import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { firstPathSegment } from "./appSegments.js";
import { hasConsultantArea } from "../features/consultant/consultantAccess.js";
import {
  capturePostLoginRedirectFromPathnameAndSearchStr,
  consumePostLoginNavigateArgs,
  isReturnableFinclaPathname,
} from "./postLoginRedirect.js";

/**
 * Dois redirects correlatos do shell:
 *
 * 1. **Pré-login**: se o utilizador está numa rota privada sem sessão, captura o destino
 *    para reenvio após login e manda para `/`.
 * 2. **Pós-login**: ao entrar autenticado em `/` (ou `""`), consome o redirect capturado
 *    ou cai para `/dashboard`.
 */
export function useAuthRedirects({
  session,
  pathname,
  searchStr,
  showOnboarding,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (session.isBootstrapping) return;
    if (session.isAuthenticated) return;
    if (!firstPathSegment(pathname)) return;
    if (isReturnableFinclaPathname(pathname)) {
      capturePostLoginRedirectFromPathnameAndSearchStr(pathname, searchStr);
    }
    navigate({ to: "/", replace: true });
  }, [
    session.isBootstrapping,
    session.isAuthenticated,
    pathname,
    searchStr,
    navigate,
  ]);

  useEffect(() => {
    if (session.isBootstrapping) return;
    if (!session.isAuthenticated) return;
    if (showOnboarding || session.onboardingRequired) return;
    if (pathname !== "/" && pathname !== "") return;
    const next = consumePostLoginNavigateArgs();
    if (next) {
      navigate(next);
      return;
    }
    // Consultores caem direto na área do consultor (seu trabalho primário); os
    // demais no app pessoal. O switcher "Consultor ⇄ Minha conta" permite trocar.
    const fallback = hasConsultantArea(session.user) ? "/consultant" : "/dashboard";
    navigate({ to: fallback, replace: true });
  }, [
    session.isBootstrapping,
    session.isAuthenticated,
    session.onboardingRequired,
    session.user,
    showOnboarding,
    pathname,
    navigate,
  ]);
}
