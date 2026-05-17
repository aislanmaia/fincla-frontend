import { useCallback, useEffect, useState } from "react";

import { getCurrentSubscription } from "../../../api/subscriptions.js";
import { handleApiError } from "../../../api/client.ts";

/**
 * Hook que carrega a assinatura do usuário autenticado (plano embedado +
 * últimas faturas) e expõe controle de refresh. As últimas faturas já vêm
 * na resposta de `getCurrentSubscription`, então não disparamos uma segunda
 * chamada — quem precisa de paginação completa usa `listInvoices` direto.
 *
 * Estado:
 *   - `isLoading` true durante o primeiro fetch e em `refresh()`.
 *   - `error` mensagem amigável (passa por `handleApiError`).
 *   - `subscription` objeto com `.plan`, `.status`, `.recent_invoices` etc.
 *
 * `enabled=false` deixa o hook ocioso (útil quando o usuário ainda não
 * autenticou ou estamos em modo demo).
 */
export function useSubscriptionData({ enabled = true } = {}) {
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await getCurrentSubscription();
      setSubscription(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      setSubscription(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSubscription(null);
      setError("");
      return;
    }
    refresh();
  }, [enabled, refresh]);

  return {
    subscription,
    recentInvoices: subscription?.recent_invoices ?? [],
    isLoading,
    error,
    refresh,
  };
}
