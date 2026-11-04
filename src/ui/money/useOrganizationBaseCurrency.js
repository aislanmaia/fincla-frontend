import { useEffect, useState } from "react";

import { getOrganization } from "../../api/organizations";

/**
 * A moeda base da organização (`GET /organizations/{id}` → `base_currency`), para
 * orientar a cotação ("1 <estrangeira> = <base>"). Só busca com `enabled`, e uma vez
 * por organização. `{ status: "loading" | "ready", currency }`; falha = `ready` com
 * `currency: null` — a direção cai no "1 <origem> = <destino>", nunca num chute.
 */
export function useOrganizationBaseCurrency(organizationId, { enabled = true } = {}) {
  const [state, setState] = useState({ orgId: null, currency: null });
  const needed = enabled && !!organizationId && state.orgId !== organizationId;
  useEffect(() => {
    if (!needed) return undefined;
    let cancelled = false;
    getOrganization(organizationId)
      .then((org) => String(org?.base_currency ?? "").trim().toUpperCase() || null)
      .catch(() => null)
      .then((currency) => {
        if (!cancelled) setState({ orgId: organizationId, currency });
      });
    return () => {
      cancelled = true;
    };
  }, [needed, organizationId]);
  if (!organizationId) return { status: "ready", currency: null };
  return state.orgId === organizationId ? { status: "ready", currency: state.currency } : { status: "loading", currency: null };
}
