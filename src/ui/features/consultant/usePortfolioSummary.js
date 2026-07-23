import { useCallback, useSyncExternalStore } from "react";

import {
  getSlice,
  resetSlice,
  runPortfolioSummary,
  subscribe,
} from "./portfolioSummaryStore.js";

/**
 * Liga o React ao `portfolioSummaryStore` (Consultor IA — A2).
 *
 * Fininho de propósito: não há transporte aqui. Toda a lógica (idempotência,
 * rejoin-poll, fallback no refresh, isolação por sessão) vive no store, fora do
 * React, para sobreviver ao fechamento do drawer. Igual ao `useClientEvaluation`
 * do A1, mas sem argumento — a carteira é uma só por consultor.
 */
export function usePortfolioSummary() {
  const state = useSyncExternalStore(subscribe, getSlice);
  const run = useCallback(() => runPortfolioSummary(), []);
  const refresh = useCallback(() => runPortfolioSummary({ refresh: true }), []);
  const reset = useCallback(() => resetSlice(), []);
  return { ...state, run, refresh, reset };
}

export { ERROR_INSUFFICIENT_DATA } from "./portfolioSummaryStore.js";
