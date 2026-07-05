import { useEffect, useState } from "react";

import { getMonthlyEvolution } from "../../../api/analytics";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", months: [], hasLoaded: false };

/**
 * Carrega `GET /v1/analytics/monthly-evolution?organization_id=…` (receita/despesa/
 * saldo mês a mês) da org do cliente, para o card "Evolução do patrimônio" do
 * relatório. Reusa o endpoint por-org do app pessoal — o consultor já lê reads
 * por-org com o `organization_id` do cliente. Só dispara com `organizationId` +
 * `enabled` (aba/estado ready). Mesmo padrão dos demais hooks do consultor.
 */
export function useClientMonthlyEvolution({ organizationId, enabled = true, months = 12 } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getMonthlyEvolution(organizationId, months)
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", months: data.months ?? [], hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, enabled, months]);

  return state;
}
