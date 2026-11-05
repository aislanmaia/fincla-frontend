import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildReportKpis,
  fetchReportsAnalytics,
  formatReportsApiError,
} from "../../data/reportsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  /** Relendo depois de uma transação, com os números anteriores ainda na tela. */
  isRefreshing: false,
  error: "",
  monthlyData: [],
  driftData: [],
  driftColors: {},
  compositionData: [],
  compositionWindowLabel: null,
  waterfallRows: [],
  velocityDaily: [],
  currencyUnavailable: null,
  byCurrency: [],
};

export function useReportsData({
  organizationId,
  periodo,
  enabled = true,
  /** Sobe a cada transação criada/editada/excluída no app (#272). */
  refreshKey = 0,
}) {
  const [state, setState] = useState(EMPTY_STATE);
  // Chave (org + período) da última leitura BEM-SUCEDIDA. Mesma chave = recarga
  // depois de uma transação: os gráficos ficam até os novos chegarem, e uma falha
  // não apaga o que se sabia. Chave diferente = pergunta nova, leitura do zero.
  const loadedKeyRef = useRef(null);

  useEffect(() => {
    if (!enabled || !organizationId) {
      loadedKeyRef.current = null;
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    const key = `${organizationId}|${periodo}`;
    const isRefresh = loadedKeyRef.current === key;
    // Leitura NOVA: esquece a anterior já. Se esta falhar e a pessoa voltar à chave
    // antiga, a volta é leitura nova — não "recarga" do estado da que falhou.
    if (!isRefresh) loadedKeyRef.current = null;
    setState((current) => (isRefresh
      ? { ...current, isRefreshing: true, error: "" }
      : { ...EMPTY_STATE, isLoading: true, error: "" }));

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
          currencyUnavailable: result.currencyUnavailable ?? null,
          byCurrency: result.byCurrency ?? [],
        });
        loadedKeyRef.current = key;
      })
      .catch((error) => {
        if (cancelled) return;
        if (isRefresh) {
          setState((current) => ({ ...current, isRefreshing: false, error: formatReportsApiError(error) }));
          return;
        }
        setState({
          ...EMPTY_STATE,
          error: formatReportsApiError(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, periodo, refreshKey]);

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
