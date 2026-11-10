import { useEffect, useState } from "react";
import { getReservedSummary } from "../../../api/goals";
import { listAccounts } from "../../../api/accounts";

/**
 * `GET /goals/reserved` + quais contas entram no total. Qualquer leitura falhou?
 * `null` — quem lê cai no comportamento de antes, sem inventar reserva zero.
 * `refreshKey` sobe com cada transação salva no app, como o resto da Visão Geral.
 */
export function useReservedSummary({ organizationId, enabled = true, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled || !organizationId) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([getReservedSummary(organizationId), listAccounts(organizationId, true)])
      .then(([summary, accounts]) => {
        if (cancelled) return;
        const included = new Set((accounts || []).filter((a) => a.include_in_total !== false).map((a) => a.id));
        setData({ summary, includedAccountIds: included });
      })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [organizationId, enabled, refreshKey]);
  return data;
}
