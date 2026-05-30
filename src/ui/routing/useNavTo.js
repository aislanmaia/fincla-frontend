import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

import { isAuthRouteSegment } from "./appSegments.js";
import { mergeNavSearch } from "./searchContract.js";

/**
 * `navTo(target, opts)` é o despachador de navegação do shell.
 *
 * - `target === "__logout__"`: chama `session.signOut()`, dispara `onSignOutReset`
 *   (cleanup de estado do app que vive no `App()`), e volta para `/`.
 * - Segmentos autenticados (`dashboard`, `transactions`, `cards`, etc.): navega
 *   para a rota correspondente preservando os search params via `mergeNavSearch`.
 * - `opts.cenarioId` é encaminhado para o setter de simulação.
 */
export function useNavTo({ session, setCenarioId, onSignOutReset }) {
  const navigate = useNavigate();
  return useCallback(
    (target, opts = {}) => {
      if (target === "__logout__") {
        session.signOut();
        onSignOutReset?.();
        navigate({ to: "/", replace: true });
        return;
      }
      if (opts.cenarioId) setCenarioId(opts.cenarioId);
      if (typeof target === "string" && isAuthRouteSegment(target)) {
        const to = target === "profile" ? "/profile/account" : `/${target}`;
        navigate({
          to,
          search: (prev) => mergeNavSearch(prev, target, opts),
        });
      }
    },
    [navigate, session, setCenarioId, onSignOutReset],
  );
}
