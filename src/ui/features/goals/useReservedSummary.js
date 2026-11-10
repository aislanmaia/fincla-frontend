import { useEffect, useState } from "react";
import { getReservedSummary } from "../../../api/goals";

/**
 * `GET /goals/reserved`. Falhou? `null` — quem lê cai no comportamento de antes, sem
 * inventar reserva zero. `refreshKey` sobe com cada transação salva no app, como o
 * resto da Visão Geral.
 */
export function useReservedSummary({ organizationId, enabled = true, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled || !organizationId) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    getReservedSummary(organizationId)
      .then((summary) => { if (!cancelled) setData(summary); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [organizationId, enabled, refreshKey]);
  return data;
}
