import { useCallback, useEffect, useState } from "react";

import { getConsultantClients } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Carrega GET /v1/consultant/clients — a carteira de clientes do consultor,
 * enriquecida por cliente (nome, saúde 0–100, saldo, poupança %, comprometimento %,
 * tendência, última atividade, patrimônio). "Clientes" = orgs onde o consultor tem
 * a membership de assessoria; a org própria dele é excluída no backend.
 *
 * Mesmo padrão canônico dos demais hooks de dados (guard `cancelled` + `reloadTick`
 * no `refresh()`; preserva a última lista boa no erro; `hasLoaded`). `loadedOk`
 * distingue "carregado com dado (inclusive vazio)" de "ainda não carregou".
 * `enabled=false` deixa ocioso.
 */
export function useConsultantClients({ enabled = true } = {}) {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
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
    getConsultantClients()
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
  }, [enabled, reloadTick]);

  return { clients, total, isLoading, error, hasLoaded, loadedOk, refresh };
}
