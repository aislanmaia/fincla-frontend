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
 *   - `summary` objeto `ConsultantSummaryResponse` ou `null`. Em erro de refresh
 *     o último valor bom é **preservado** (não apagamos o painel por um soluço).
 *   - `hasLoaded` distingue "ainda não buscou" (idle) de "buscou e veio vazio",
 *     evitando flash de estado vazio no primeiro render.
 *
 * `dateStart`/`dateEnd` (YYYY-MM-DD, opcionais) recortam o período; mudá-los
 * redispara o fetch. Segue o padrão dos demais hooks de dados do repo: guard
 * "último vence" via `let cancelled` no cleanup do effect, e `refresh()` é um
 * tick de reload que re-roda o mesmo effect (o `cancelled` guarda igual). Assim
 * respostas fora de ordem, ou que chegam após unmount / `enabled=false`, são
 * descartadas. `enabled=false` deixa o hook ocioso (ex.: usuário sem a capacidade).
 */
export function useConsultantSummary({ dateStart, dateEnd, enabled = true } = {}) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setError("");
      setIsLoading(false);
      setHasLoaded(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    getConsultantSummary({ date_start: dateStart, date_end: dateEnd })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setHasLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(handleApiError(err));
        setHasLoaded(true);
        // mantém o último `summary` bom em tela
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, dateStart, dateEnd, reloadTick]);

  return { summary, isLoading, error, hasLoaded, refresh };
}
