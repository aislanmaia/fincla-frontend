import { useEffect, useState } from "react";
import { getFinancialHealth } from "../../../api/financialHealth";

const EMPTY = { loading: false, error: "", data: null, hasLoaded: false };

function fmtErr(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  return e?.message || "Erro ao carregar a saúde financeira.";
}

export function useFinancialHealthData({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getFinancialHealth(organizationId)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", data, hasLoaded: true });
      })
      .catch((e) => {
        if (!cancelled) setState({ ...EMPTY, error: fmtErr(e), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return state;
}
