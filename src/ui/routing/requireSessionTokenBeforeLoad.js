import { redirect } from "@tanstack/react-router";
import { isAuthenticated } from "../data/sessionAdapter.js";
import { capturePostLoginRedirectFromLocation } from "./postLoginRedirect.js";

/**
 * Guarda de rotas autenticadas (paths em inglês): sem token armazenado, não monta o outlet.
 * A validação completa da sessão continua em `useSession` (bootstrap assíncrono).
 * Preserva pathname + query para redirecionar após login (`postLoginRedirect.js`).
 */
export function requireSessionTokenBeforeLoad(ctx) {
  if (!isAuthenticated()) {
    if (ctx?.location) {
      capturePostLoginRedirectFromLocation(ctx.location);
    }
    throw redirect({ to: "/", replace: true });
  }
}
