import { useEffect, useState } from "react";

import { getOverdueInvoices } from "../../../api/creditCards";

/**
 * Faturas vencidas da organização, buscadas ao abrir o Hub (uma chamada, todos os cartões).
 * Falha vira "sem insight": o aviso é um extra, nunca derruba a tela, e nunca repete um valor que pode estar velho.
 */
export function useOverdueInvoices({ organizationId, enabled, refreshToken = 0 }) {
  const active = Boolean(enabled && organizationId);
  const [state, setState] = useState({ organizationId: null, summary: null });

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    getOverdueInvoices(organizationId)
      .then((summary) => { if (!cancelled) setState({ organizationId, summary }); })
      .catch(() => {
        // Sem resposta, sem aviso: repetir o último valor poderia afirmar uma dívida que já foi paga.
        if (!cancelled) setState({ organizationId, summary: null });
      });
    return () => { cancelled = true; };
  }, [active, organizationId, refreshToken]);

  return active && state.organizationId === organizationId ? state.summary : null;
}
