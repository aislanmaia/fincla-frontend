import { shouldUseRealData } from "../dataMode.js";

/**
 * O Hub é a tela de `/cards` para quem tem organização com dados reais
 * (`?view=new` continua válido, só não é mais necessário). A tela clássica fica
 * apenas no modo demo/vazio, que o Hub não atende.
 */
export function CardsEntryPage({ hub, classic, dataMode, organizationId }) {
  return shouldUseRealData(organizationId, dataMode) ? hub : classic;
}
