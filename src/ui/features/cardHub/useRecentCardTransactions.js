import { useEffect, useState } from "react";

import { listTransactions } from "../../../api/transactions";

const pending = new Map();

function fetchRecent(organizationId, cardId, refreshToken) {
  const key = `${organizationId}:${cardId}:${refreshToken}`;
  if (!pending.has(key)) {
    const today = new Date();
    const dateEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const request = listTransactions({
      organization_id: organizationId,
      credit_card_id: cardId,
      page: 1,
      limit: 4,
      date_end: dateEnd,
      sort_by: "date",
      sort_order: "desc",
    }).finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return pending.get(key);
}

export function useRecentCardTransactions({ organizationId, cardId, enabled, refreshToken }) {
  const [state, setState] = useState({ key: null, rows: [], error: false });
  const key = enabled && cardId != null ? `${organizationId}:${cardId}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    fetchRecent(organizationId, cardId, refreshToken)
      .then((response) => {
        if (!cancelled) setState({ key, rows: response.data ?? [], error: false });
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({
          key,
          rows: previous.key === key ? previous.rows : [],
          error: true,
        }));
      });
    return () => { cancelled = true; };
  }, [key, organizationId, cardId, refreshToken]);

  return state.key === key ? state : { key, rows: [], error: false, loading: Boolean(key) };
}
