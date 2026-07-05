/**
 * Modelo puro da carteira de clientes do consultor (A2.2): busca + filtro por
 * faixa de risco + ordenação. Sem React — a `ConsultantClientsPage` liga o hook
 * `useConsultantClients` a esta seleção client-side e às visões card/tabela.
 *
 * Ids em inglês (estado/URL futura), labels PT-BR na UI.
 */

/**
 * Faixa de saúde 0–100 (maior = melhor): em dia ≥70 · atenção 40–69 · em risco <40.
 * `health` (índice de saúde) e o `risk_score` de `ConsultantAttentionList` são
 * campos calculados de forma independente no backend — não são complementares.
 */
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

/**
 * Contagem de clientes por faixa (para os contadores dos filtros da carteira,
 * fiel à referência): `all` + `healthy`/`attention`/`risk`. Pura.
 */
export function countClientsByBand(clients) {
  const list = Array.isArray(clients) ? clients : [];
  const counts = { all: list.length, healthy: 0, attention: 0, risk: 0 };
  for (const c of list) counts[clientHealthBand(Number(c?.health) || 0)] += 1;
  return counts;
}

/** Soma o patrimônio de todos os clientes (kicker "… sob acompanhamento"). */
export function totalPatrimonio(clients) {
  const list = Array.isArray(clients) ? clients : [];
  return list.reduce((s, c) => s + (Number.parseFloat(c?.patrimonio) || 0), 0);
}

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
  // `filtered` já é um array novo (de `.filter`), então `.sort` aqui não muta a entrada.
  return filtered.sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    if (typeof va === "string") return va.localeCompare(vb, "pt-BR") * dir;
    return (va - vb) * dir;
  });
}

/**
 * CSV (pt-BR, separador ";") da carteira de clientes para o botão "Exportar" —
 * uma linha por cliente com os campos já carregados por `/consultant/clients`.
 * Sanitiza `;`/quebras de linha nos textos para não quebrar as colunas.
 */
function csvCell(value) {
  return String(value ?? "").replace(/[;\r\n]+/g, " ").trim();
}

export function buildClientsCsv(clients) {
  const list = Array.isArray(clients) ? clients : [];
  const header = ["Cliente", "Organização", "Saúde", "Patrimônio", "Saldo", "Poupança %", "Dívida %", "Última atividade"];
  const rows = list.map((c) => [
    csvCell(c?.client_name),
    csvCell(c?.organization_name),
    Math.round(Number(c?.health) || 0),
    Number.parseFloat(c?.patrimonio) || 0,
    Number.parseFloat(c?.balance) || 0,
    Number(c?.savings_pct) || 0,
    Number(c?.debt_pct) || 0,
    csvCell(c?.last_active),
  ]);
  return [header, ...rows].map((r) => r.join(";")).join("\n");
}
