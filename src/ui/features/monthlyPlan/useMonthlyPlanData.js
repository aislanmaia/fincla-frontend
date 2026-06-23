import { useCallback, useEffect, useState } from "react";
import { getMonthlyPlan, upsertMonthlyPlan } from "../../../api/monthlyPlans";

const EMPTY = { loading: false, saving: false, error: "", data: null, hasLoaded: false };

function fmtErr(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  return e?.message || "Erro ao carregar o plano.";
}

export function useMonthlyPlanData({ organizationId, year, month, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getMonthlyPlan(organizationId, year, month)
      .then((data) => {
        if (!cancelled) setState({ loading: false, saving: false, error: "", data, hasLoaded: true });
      })
      .catch((e) => {
        if (!cancelled) setState({ ...EMPTY, error: fmtErr(e), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, year, month]);

  const save = useCallback(
    async (body) => {
      setState((s) => ({ ...s, saving: true, error: "" }));
      try {
        const data = await upsertMonthlyPlan(organizationId, year, month, body);
        setState({ loading: false, saving: false, error: "", data, hasLoaded: true });
        return data;
      } catch (e) {
        setState((s) => ({ ...s, saving: false, error: fmtErr(e) }));
        throw e;
      }
    },
    [organizationId, year, month],
  );

  return { ...state, save };
}
