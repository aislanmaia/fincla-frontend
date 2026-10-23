import { useEffect, useState } from "react";

import { getOverdueInvoices } from "../../../api/creditCards";

/**
 * Faturas vencidas da organização, buscadas ao abrir o Hub (uma chamada, todos os cartões).
 * Falha vira "sem insight" (ou o último valor da mesma organização): o aviso é um extra, nunca derruba a tela.
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
        if (!cancelled) setState((previous) => (previous.organizationId === organizationId ? previous : { organizationId, summary: null }));
      });
    return () => { cancelled = true; };
  }, [active, organizationId, refreshToken]);

  return active && state.organizationId === organizationId ? state.summary : null;
}
