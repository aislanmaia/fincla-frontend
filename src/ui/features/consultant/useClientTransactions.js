import { useEffect, useState } from "react";

import { listTransactionsForUi, mapApiTransactionToUi } from "../../data/transactionsAdapter.js";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", transactions: [], hasLoaded: false };

/**
 * Carrega as transações da org do cliente para a aba "Transações" do relatório
 * (RF.2), mapeadas para a UI (`mapApiTransactionToUi`). Mesmo padrão por-org
 * (guard `cancelled`, `enabled`, `hasLoaded`). Traz as mais recentes (limit 100).
 */
export function useClientTransactions({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    listTransactionsForUi({
      organization_id: organizationId,
      limit: 100,
      sort_by: "date",
      sort_order: "desc",
    })
      .then((res) => {
        if (cancelled) return;
        const transactions = (res.data ?? []).map(mapApiTransactionToUi);
        setState({ loading: false, error: "", transactions, hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return state;
}
