import { useEffect, useState } from "react";

import { getIncomeCommitment } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", monthly: [], hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/income-commitment` (% da renda comprometida com
 * faturas de cartão, mês a mês, de toda a carteira) para o card "Comprometimento
 * de renda" do Insights. Mesmo padrão dos hooks do consultor.
 */
export function useConsultantIncomeCommitment({ enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getIncomeCommitment()
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
