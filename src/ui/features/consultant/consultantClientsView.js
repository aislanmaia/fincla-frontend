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
 *
 * `health == null` = **ainda não calculado**, e não zero. O backend só tem score
 * depois que o snapshot canônico (`financial_health_scores`) existe. Um cliente
 * não avaliado não pode ser pintado de vermelho: ele recebe a faixa neutra
 * `"none"`, que não aparece em nenhum filtro de risco.
 */
export const HEALTH_BAND_NONE = "none";

export function clientHealthBand(health) {
  if (health == null || Number.isNaN(Number(health))) return HEALTH_BAND_NONE;
  if (health >= 70) return "healthy";
  if (health >= 40) return "attention";
  return "risk";
}

/**
 * Filtros por faixa de SAÚDE — 'all' primeiro; os demais casam com `clientHealthBand`.
 *
 * Os rótulos descrevem o **nível** de saúde, não risco. "Em risco" ficou reservado
 * para a lista do Painel (`clients-at-risk`), que é outra coisa: um **gatilho** por
 * regras ("gasto > renda em 4 meses"), com motivo textual e limiares configuráveis.
 *
 * Os dois são ortogonais. Cliente sem transação nenhuma tem saúde baixa e risco
 * ZERO; cliente com patrimônio alto pode estar gastando mais do que ganha há 4
 * meses — saúde boa, risco real. Chamar a faixa `<40` de "Em risco" fazia parecer
 * que um substituía o outro.
 */
export const RISK_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "risk", label: "Frágil" },
  { id: "attention", label: "Atenção" },
  { id: "healthy", label: "Saudável" },
  { id: HEALTH_BAND_NONE, label: "Sem score" },
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
  // `none` conta separado: cliente sem score não é "em risco". `Number(x) || 0`
  // transformaria `null` em 0 e o jogaria na pior faixa.
  const counts = { all: list.length, healthy: 0, attention: 0, risk: 0, none: 0 };
  for (const c of list) counts[clientHealthBand(c?.health)] += 1;
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

/** Valor comparável de uma chave de ordenação. `null` em `health` vira `null`, não 0. */
function sortValue(clientItem, sortKey) {
  if (sortKey === "patrimonio") return Number.parseFloat(clientItem.patrimonio) || 0;
  if (sortKey === "name") return normalize(clientItem.client_name || clientItem.organization_name);
  return clientItem.health == null ? null : Number(clientItem.health);
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
    // Sem score vai SEMPRE para o fim, independente da direção: ele não é "pior"
    // nem "melhor" que ninguém — não há diagnóstico para ordenar.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
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
    // Sem score exporta vazio, não `0`: uma planilha com 0 vira um diagnóstico falso.
    c?.health == null ? "" : Math.round(Number(c.health)),
    Number.parseFloat(c?.patrimonio) || 0,
    Number.parseFloat(c?.balance) || 0,
    Number(c?.savings_pct) || 0,
    Number(c?.debt_pct) || 0,
    csvCell(c?.last_active),
  ]);
  return [header, ...rows].map((r) => r.join(";")).join("\n");
}
