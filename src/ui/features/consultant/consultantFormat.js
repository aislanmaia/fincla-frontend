export const DASH = "—";
const LOADING = "…";

/**
 * Formata um valor agregado do consultor distinguindo os 3 estados:
 * carregando ("…"), carregado-vazio ("—") e com dado (via `format`).
 * Compartilhado por `consultantKpis` e `consultantRiskSemaphore` para não
 * duplicar a regra de placeholder.
 */
export function aggregateValue(raw, hasLoaded, format) {
  if (raw != null) return format(raw);
  return hasLoaded ? DASH : LOADING;
}
