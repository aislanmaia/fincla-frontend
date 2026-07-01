import { useCallback, useEffect, useState } from "react";

import { getFinancialHealthIndex } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Carrega GET /v1/consultant/financial-health-index — o índice de saúde
 * financeira **agregado** de toda a base do consultor (média ponderada dos
 * scores de balanço/dívida/reserva). Alimenta o KPI "Saúde média da base".
 *
 * Segue o mesmo padrão de `useConsultantSummary` (guard "último vence" via
 * `let cancelled` + `reloadTick` no `refresh()`; preserva o último valor bom
 * no erro; `hasLoaded` distingue idle de carregado). `dateStart`/`dateEnd`
 * (YYYY-MM-DD, opcionais) recortam o período. `enabled=false` deixa ocioso.
 */
export function useConsultantHealthIndex({ dateStart, dateEnd, enabled = true } = {}) {
  const [healthIndex, setHealthIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  useEffect(() => {
    if (!enabled) {
      setHealthIndex(null);
      setError("");
      setIsLoading(false);
      setHasLoaded(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    getFinancialHealthIndex({ date_start: dateStart, date_end: dateEnd })
      .then((data) => {
        if (cancelled) return;
        setHealthIndex(data);
        setHasLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(handleApiError(err));
        setHasLoaded(true);
        // mantém o último `healthIndex` bom em tela
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, dateStart, dateEnd, reloadTick]);

  return { healthIndex, isLoading, error, hasLoaded, refresh };
}
