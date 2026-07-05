import { T } from "../../tokens";
import { aggregateValue, fmtBRL0 } from "./consultantFormat";

/**
 * Modelo puro dos KPIs do Painel da base do consultor — 4 cards reais, na ordem
 * da spec de UI. As fontes:
 *   - `/consultant/financial-health-index` → `organizations_count` (clientes) e
 *     `index` (saúde média);
 *   - `/consultant/clients` → soma de `patrimonio` (patrimônio líquido agregado
 *     da base), computada na página via `totalPatrimonio` e passada aqui;
 *   - `/consultant/clients-at-risk` → `total` de clientes que precisam de atenção.
 *
 * Cada valor tem seu par `*Loaded` para distinguir "ainda buscando" ("…") de
 * "carregado e vazio/zero" ("—" quando ausente, ou o número real — inclusive 0).
 * Sem histórico agregado, então não exibimos delta/trend.
 *
 * @param {{
 *   healthIndex?: object|null, hasLoaded?: boolean,
 *   patrimonio?: number|null, patrimonioLoaded?: boolean,
 *   attention?: number|null, attentionLoaded?: boolean,
 * }} input
 * @returns {Array<{ id, label, value, sub, accent, soon }>}
 */
export function buildConsultantKpis({
  healthIndex,
  hasLoaded = false,
  patrimonio = null,
  patrimonioLoaded = false,
  attention = null,
  attentionLoaded = false,
} = {}) {
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
      value: aggregateValue(patrimonio, patrimonioLoaded, fmtBRL0),
      sub: "sob gestão",
      accent: T.purple,
      soon: false,
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
      id: "attention",
      label: "Precisam de atenção",
      value: aggregateValue(attention, attentionLoaded, (n) => String(n)),
      sub: clients != null ? `de ${clients} clientes` : "acompanhamento",
      accent: T.amber,
      soon: false,
    },
  ];
}
