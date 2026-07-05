import { useEffect, useState } from "react";

import { getGoalsProgressByType } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", byType: [], hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/goals-progress-by-type` (progresso médio das metas
 * agrupadas por tipo em toda a carteira) para o card "Progresso de metas por
 * tipo" do Insights. Mesmo padrão dos hooks do consultor.
 */
export function useConsultantGoalsProgress({ enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getGoalsProgressByType()
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", byType: data.by_type ?? [], hasLoaded: true });
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
