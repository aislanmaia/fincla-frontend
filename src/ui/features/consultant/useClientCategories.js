import { useEffect, useState } from "react";

import { getByCategory } from "../../../api/analytics";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", categories: [], hasLoaded: false };

/**
 * Carrega `GET /v1/analytics/by-category` (despesas por categoria) para a org do
 * cliente — alimenta o donut "para onde vai o dinheiro" do relatório (RF.1b).
 * Mesmo padrão dos demais hooks por-org (guard `cancelled`, `enabled`, `hasLoaded`).
 * `dateStart`/`dateEnd` aplicam o período escolhido no relatório.
 */
export function useClientCategories({ organizationId, dateStart, dateEnd, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getByCategory(organizationId, { dateStart, dateEnd, transactionType: "expense" })
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", categories: data.categories ?? [], hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [dateEnd, dateStart, enabled, organizationId]);

  return state;
}
