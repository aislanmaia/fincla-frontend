import { useCallback, useEffect, useRef, useState } from "react";

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
 * redispara o fetch. Como há deps reativas (diferente de `useSubscriptionData`,
 * que não tem params), usamos um guard "último vence" (`requestIdRef`): só a
 * requisição mais recente escreve no estado, então respostas fora de ordem ou
 * que chegam após unmount / `enabled=false` são descartadas.
 * `enabled=false` deixa o hook ocioso (ex.: usuário sem a capacidade).
 */
export function useConsultantSummary({ dateStart, dateEnd, enabled = true } = {}) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError("");
    try {
      const data = await getConsultantSummary({
        date_start: dateStart,
        date_end: dateEnd,
      });
      if (requestId !== requestIdRef.current) return null; // superseded
      setSummary(data);
      setHasLoaded(true);
      return data;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null; // superseded
      setError(handleApiError(err));
      setHasLoaded(true);
      return null; // mantém o último `summary` bom em tela
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [dateStart, dateEnd]);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1; // invalida qualquer fetch em voo
      setSummary(null);
      setError("");
      setIsLoading(false);
      setHasLoaded(false);
      return undefined;
    }
    refresh();
    return () => {
      // invalida o fetch em voo ao trocar deps / desmontar
      requestIdRef.current += 1;
    };
  }, [enabled, refresh]);

  return { summary, isLoading, error, hasLoaded, refresh };
}
