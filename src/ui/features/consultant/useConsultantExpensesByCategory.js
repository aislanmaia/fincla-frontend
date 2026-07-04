import { useEffect, useState } from "react";

import { getExpensesByCategory } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", categories: [], total: 0, hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/expenses-by-category` (gasto agregado por categoria
 * de toda a carteira) para o Insights (S4). Mesmo padrão dos hooks do consultor
 * (guard `cancelled`, `enabled`, `hasLoaded`).
 */
export function useConsultantExpensesByCategory({ enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getExpensesByCategory()
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", categories: data.categories ?? [], total: Number(data.total_expenses) || 0, hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
