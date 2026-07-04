import { clientHealthBand } from "./consultantClientsView";

/**
 * Modelo puro do "Semáforo da carteira" do Painel da base (RF.5), fiel ao
 * `RiskDonutPanel` da referência (`consultor/cons-painel.jsx`): distribuição
 * **3-vias** (saudável / atenção / em risco) da carteira, contada pela saúde
 * por-cliente da lista enriquecida (`useConsultantClients`, disponível desde a
 * A2.0 — antes só havia agregado, por isso a S1 entregou 2-vias). O centro do
 * donut mostra a saúde média agregada (`health-index`). Sem React/tokens.
 */

/** Conta os clientes por faixa de saúde + expõe o valor central (saúde média). */
export function buildBaseSemaphore({ clients, hasLoaded = false, healthIndex = null } = {}) {
  const list = Array.isArray(clients) ? clients : [];
  const counts = { healthy: 0, attention: 0, risk: 0 };
  for (const c of list) {
    counts[clientHealthBand(Number(c?.health) || 0)] += 1;
  }
  const total = list.length;
  return {
    counts,
    total,
    // Distribuição só é confiável quando a lista de clientes carregou com dado.
    splitAvailable: hasLoaded && total > 0,
    centerValue: healthIndex != null ? String(Math.round(Number(healthIndex))) : "—",
  };
}
