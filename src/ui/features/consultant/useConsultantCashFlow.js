import { useEffect, useState } from "react";

import { getCashFlow } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", monthly: [], hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/cash-flow` (receita/despesa/saldo mês a mês de toda
 * a carteira) para o gráfico "Fluxo da base" do Insights. Mesmo padrão dos hooks
 * do consultor (guard `cancelled`, `enabled`, `hasLoaded`).
 */
export function useConsultantCashFlow({ enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getCashFlow()
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", monthly: data.monthly_data ?? [], hasLoaded: true });
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
