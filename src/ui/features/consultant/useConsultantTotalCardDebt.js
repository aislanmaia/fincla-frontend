import { useEffect, useState } from "react";

import { getTotalCreditCardDebt } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", totalDebt: null, hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/total-credit-card-debt` (dívida de cartão em aberto
 * somada de toda a carteira) para o KPI "Dívida de cartão" do Insights. Mesmo
 * padrão dos hooks do consultor. `totalDebt` fica `null` até carregar (distingue
 * "buscando" de "R$ 0 real").
 */
export function useConsultantTotalCardDebt({ enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getTotalCreditCardDebt()
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", totalDebt: Number(data.total_debt) || 0, hasLoaded: true });
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
