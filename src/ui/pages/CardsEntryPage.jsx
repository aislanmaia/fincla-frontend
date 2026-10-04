import { useSearch } from "@tanstack/react-router";

import { shouldUseRealData } from "../dataMode.js";
import { FC } from "../routing/searchContract.js";

/**
 * Porta de entrada de `/cards`: o Hub é a tela padrão e a tela anterior segue
 * em `/cards?view=classic`. Sem dados reais (modo demo/vazio) o Hub não tem o
 * que mostrar, então a tela anterior atende.
 */
export function CardsEntryPage({ hub, classic, dataMode, organizationId }) {
  const search = useSearch({ strict: false });
  const useClassic = search?.[FC.VIEW] === "classic" || !shouldUseRealData(organizationId, dataMode);
  return useClassic ? classic : hub;
}
