import { T } from "../../tokens";
import { aggregateValue, DASH } from "./consultantFormat";

/**
 * Modelo puro dos KPIs do Painel da base do consultor. Mapeia a resposta
 * agregada `/consultant/financial-health-index` (que já carrega
 * `organizations_count` e o `index` de saúde) para os 4 cards do topo, na
 * ordem da spec de UI — uma só chamada cobre os dois KPIs reais.
 *
 * "Patrimônio acompanhado" (patrimônio líquido agregado) e "Honorários
 * recorrentes" (MRR) ainda não têm dado no backend — ficam marcados `soon`
 * ("em breve"), sem inventar número. Não há histórico agregado, então não
 * exibimos delta/trend.
 *
 * `hasLoaded` distingue "ainda buscando" de "carregado e vazio": antes do
 * primeiro fetch os KPIs reais mostram "…"; só depois de carregado um valor
 * ausente vira "—" (evita o flash de estado vazio no primeiro render).
 *
 * @param {{ healthIndex?: object|null, hasLoaded?: boolean }} input
 * @returns {Array<{ id, label, value, sub, accent, soon }>}
 */
export function buildConsultantKpis({ healthIndex, hasLoaded = false } = {}) {
  const clients = healthIndex?.organizations_count;
  const health = healthIndex?.index;

  return [
    {
      id: "clients",
      label: "Clientes ativos",
      value: aggregateValue(clients, hasLoaded, (n) => String(n)),
      sub: "na carteira",
      accent: T.blue,
      soon: false,
    },
    {
      id: "patrimonio",
      label: "Patrimônio acompanhado",
      value: DASH,
      sub: "sob gestão",
      accent: T.inkGhost,
      soon: true,
    },
    {
      id: "health",
      label: "Saúde média da base",
      value: aggregateValue(health, hasLoaded, (n) => String(Math.round(n))),
      sub: health != null ? "de 100" : "semáforo",
      accent: T.green,
      soon: false,
    },
    {
      id: "mrr",
      label: "Honorários recorrentes",
      value: DASH,
      sub: "MRR da carteira",
      accent: T.inkGhost,
      soon: true,
    },
  ];
}
