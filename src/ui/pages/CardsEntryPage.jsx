import { useSearch } from "@tanstack/react-router";

import { shouldUseRealData } from "../dataMode.js";
import { FC } from "../routing/searchContract.js";

/**
 * A tela clássica é o padrão de `/cards`. O Hub em desenvolvimento só abre
 * com `?view=new` e dados reais; modo demo/vazio continua na tela clássica.
 */
export function CardsEntryPage({ hub, classic, dataMode, organizationId }) {
  const search = useSearch({ strict: false });
  const useHub = search?.[FC.VIEW] === "new" && shouldUseRealData(organizationId, dataMode);
  return useHub ? hub : classic;
}
