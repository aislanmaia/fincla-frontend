import { useEffect, useMemo, useState } from "react";
import {
  buildReportKpis,
  fetchReportsAnalytics,
  formatReportsApiError,
} from "../../data/reportsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  monthlyData: [],
  driftData: [],
  driftColors: {},
  compositionData: [],
  compositionWindowLabel: null,
  waterfallRows: [],
  velocityDaily: [],
};

export function useReportsData({
  organizationId,
  periodo,
  enabled = true,
}) {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    setState({
      ...EMPTY_STATE,
      isLoading: true,
      error: "",
    });

    fetchReportsAnalytics(organizationId, periodo)
      .then((result) => {
        if (cancelled) return;
        setState({
          isLoading: false,
          error: "",
          monthlyData: result.monthlyData,
          driftData: result.drift.driftData,
          driftColors: result.drift.driftColors,
          compositionData: result.compositionData,
          compositionWindowLabel: result.compositionWindowLabel,
          waterfallRows: result.waterfallRows ?? [],
          velocityDaily: result.velocityDaily ?? [],
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          ...EMPTY_STATE,
          error: formatReportsApiError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, periodo]);

  const kpis = useMemo(
    () => buildReportKpis(state.monthlyData),
    [state.monthlyData],
  );

  return {
    ...state,
    kpis,
    hasRealData: state.monthlyData.length > 0,
  };
}
