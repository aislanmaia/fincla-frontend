import { useCallback, useSyncExternalStore } from "react";

import {
  getSlice,
  resetSlice,
  runPortfolioTrends,
  subscribe,
} from "./portfolioTrendsStore.js";

/**
 * Liga o React ao `portfolioTrendsStore` (Consultor IA — A3). Fininho: toda a
 * lógica vive no store, fora do React. Igual ao `usePortfolioSummary`, sem
 * argumento — a carteira é uma só.
 */
export function usePortfolioTrends() {
  const state = useSyncExternalStore(subscribe, getSlice);
  const run = useCallback(() => runPortfolioTrends(), []);
  const refresh = useCallback(() => runPortfolioTrends({ refresh: true }), []);
  const reset = useCallback(() => resetSlice(), []);
  return { ...state, run, refresh, reset };
}

export { ERROR_INSUFFICIENT_DATA } from "./portfolioTrendsStore.js";
