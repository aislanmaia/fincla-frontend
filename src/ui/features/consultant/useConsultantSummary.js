import { useCallback, useEffect, useState } from "react";

import { getConsultantSummary } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Carrega GET /v1/consultant/summary — o resumo consolidado de todas as
 * organizações (clientes) do consultor: renda, despesas, balanço, número de
 * transações e de organizações no período (multi_org_dashboard).
 *
 * Estado:
 *   - `isLoading` true durante o primeiro fetch e em `refresh()`.
 *   - `error` mensagem amigável (passa por `handleApiError`).
 *   - `summary` objeto `ConsultantSummaryResponse` ou `null`.
 *
 * `dateStart`/`dateEnd` (YYYY-MM-DD, opcionais) recortam o período; mudá-los
 * redispara o fetch. `enabled=false` deixa o hook ocioso (ex.: usuário sem a
 * capacidade ou área ainda não montada).
 */
export function useConsultantSummary({ dateStart, dateEnd, enabled = true } = {}) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = {};
      if (dateStart) params.date_start = dateStart;
      if (dateEnd) params.date_end = dateEnd;
      const data = await getConsultantSummary(
        Object.keys(params).length ? params : undefined
      );
      setSummary(data);
      return data;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      setSummary(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [dateStart, dateEnd]);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setError("");
      return;
    }
    refresh();
  }, [enabled, refresh]);

  return { summary, isLoading, error, refresh };
}
