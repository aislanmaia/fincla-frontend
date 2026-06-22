import { useEffect, useMemo, useState } from "react";
import { getEconomyCapacity } from "../../../api/financialHealth";

const EMPTY = { isLoading: false, error: "", data: null, hasLoaded: false };

export function formatCapacityApiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return error?.message || "Erro ao carregar a capacidade de economia.";
}

/** Carrega GET /v1/financial-health/economy-capacity (read-only). */
export function useEconomyCapacityData({ organizationId, months = 3, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, isLoading: true });
    getEconomyCapacity(organizationId, months)
      .then((data) => {
        if (cancelled) return;
        setState({ isLoading: false, error: "", data, hasLoaded: true });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ ...EMPTY, error: formatCapacityApiError(error), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, months]);

  return useMemo(() => state, [state]);
}
