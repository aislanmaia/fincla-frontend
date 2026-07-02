/**
 * Modelo puro da carteira de clientes do consultor (A2.2): busca + filtro por
 * faixa de risco + ordenação. Sem React — a `ConsultantClientsPage` liga o hook
 * `useConsultantClients` a esta seleção client-side e às visões card/tabela.
 *
 * Ids em inglês (estado/URL futura), labels PT-BR na UI.
 */

/** Faixa de saúde 0–100 (maior = melhor). Espelha o inverso do risco em `ConsultantAttentionList`. */
export function clientHealthBand(health) {
  if (health >= 70) return "healthy";
  if (health >= 40) return "attention";
  return "risk";
}

/** Filtros de risco — 'all' primeiro; os demais casam com `clientHealthBand`. */
export const RISK_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "risk", label: "Em risco" },
  { id: "attention", label: "Atenção" },
  { id: "healthy", label: "Em dia" },
];

/** Chaves de ordenação (saúde/patrimônio/nome). */
export const SORT_OPTIONS = [
  { id: "health", label: "Saúde" },
  { id: "patrimonio", label: "Patrimônio" },
  { id: "name", label: "Nome" },
];

/** Normaliza para busca: minúsculas e sem acentos. */
function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Valor comparável de uma chave de ordenação. */
function sortValue(clientItem, sortKey) {
  if (sortKey === "patrimonio") return Number.parseFloat(clientItem.patrimonio) || 0;
  if (sortKey === "name") return normalize(clientItem.client_name || clientItem.organization_name);
  return Number(clientItem.health) || 0; // health (default)
}

/**
 * Aplica busca (nome do cliente ou da org), filtro de risco e ordenação a uma
 * lista de `ConsultantClient`. Não muta a entrada. `sortKey` default = "health"
 * e `sortDir` default = "asc" (piores primeiro — a leitura que o consultor quer).
 */
export function selectConsultantClients(clients, { query = "", riskFilter = "all", sortKey = "health", sortDir = "asc" } = {}) {
  if (!Array.isArray(clients)) return [];

  const q = normalize(query).trim();
  const filtered = clients.filter((c) => {
    if (riskFilter !== "all" && clientHealthBand(c.health) !== riskFilter) return false;
    if (q && !normalize(c.client_name).includes(q) && !normalize(c.organization_name).includes(q)) return false;
    return true;
  });

  const dir = sortDir === "desc" ? -1 : 1;
  return filtered.slice().sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    if (typeof va === "string") return va.localeCompare(vb, "pt-BR") * dir;
    return (va - vb) * dir;
  });
}
