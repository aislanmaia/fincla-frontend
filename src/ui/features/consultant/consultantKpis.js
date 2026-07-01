import { T } from "../../tokens";

const DASH = "—";

/**
 * Modelo puro dos KPIs do Painel da base do consultor. Mapeia as respostas
 * agregadas (`/consultant/summary` e `/consultant/financial-health-index`)
 * para os 4 cards do topo, na ordem da spec de UI.
 *
 * Dois KPIs têm fonte real hoje (clientes, saúde média); "Patrimônio
 * acompanhado" (patrimônio líquido agregado) e "Honorários recorrentes" (MRR)
 * ainda não têm dado no backend — ficam marcados `soon` ("em breve"), sem
 * inventar número. Não há histórico agregado, então não exibimos delta/trend.
 *
 * @param {{ summary?: object|null, healthIndex?: object|null, isLoading?: boolean }} input
 * @returns {Array<{ id, label, value, sub, accent, soon }>}
 */
export function buildConsultantKpis({ summary, healthIndex, isLoading = false } = {}) {
  const clients = summary?.organizations_count;
  const health = healthIndex?.index;

  const readyValue = (raw, format) => {
    if (raw != null) return format(raw);
    return isLoading ? "…" : DASH;
  };

  return [
    {
      id: "clients",
      label: "Clientes ativos",
      value: readyValue(clients, (n) => String(n)),
      sub: "na carteira",
      accent: T.blue,
      soon: false,
    },
    {
      id: "patrimonio",
      label: "Patrimônio acompanhado",
      value: DASH,
      sub: "em breve",
      accent: T.inkGhost,
      soon: true,
    },
    {
      id: "health",
      label: "Saúde média da base",
      value: readyValue(health, (n) => String(Math.round(n))),
      sub: health != null ? "de 100" : "semáforo",
      accent: T.green,
      soon: false,
    },
    {
      id: "mrr",
      label: "Honorários recorrentes",
      value: DASH,
      sub: "MRR · em breve",
      accent: T.inkGhost,
      soon: true,
    },
  ];
}
