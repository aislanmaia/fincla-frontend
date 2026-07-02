import { useCallback, useEffect, useState } from "react";

import { getClientsAtRisk } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Carrega GET /v1/consultant/clients-at-risk — os clientes da carteira em risco
 * (gasto > renda, endividamento alto etc.), ordenados por `risk_score`.
 * Alimenta a lista "Precisam de atenção" e o segmento de risco do semáforo.
 *
 * Mesmo padrão canônico dos demais hooks de dados (guard `cancelled` +
 * `reloadTick` no `refresh()`; preserva último dado bom no erro; `hasLoaded`).
 * `limit` recorta o top N; `enabled=false` deixa ocioso.
 */
export function useConsultantClientsAtRisk({ limit, enabled = true } = {}) {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  // `loadedOk` fica true assim que UMA resposta de sucesso chega e permanece
  // true em erros posteriores — distingue "carregado com dado (inclusive vazio
  // = base saudável)" de "0 default / ainda não carregou". Necessário porque
  // `total=0` é ambíguo (0 real em risco × nunca carregou).
  const [loadedOk, setLoadedOk] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => setReloadTick((tick) => tick + 1), []);

  useEffect(() => {
    if (!enabled) {
      setClients([]);
      setTotal(0);
      setError("");
      setIsLoading(false);
      setHasLoaded(false);
      setLoadedOk(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    setError("");
    getClientsAtRisk(limit != null ? { limit } : undefined)
      .then((data) => {
        if (cancelled) return;
        setClients(data.clients ?? []);
        setTotal(data.total ?? 0);
        setHasLoaded(true);
        setLoadedOk(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(handleApiError(err));
        setHasLoaded(true);
        // mantém a última lista boa em tela e `loadedOk` se já houve sucesso
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, limit, reloadTick]);

  return { clients, total, isLoading, error, hasLoaded, loadedOk, refresh };
}
