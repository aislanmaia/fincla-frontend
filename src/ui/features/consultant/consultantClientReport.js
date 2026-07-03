/**
 * Modelo puro do relatório do cliente (A3.1, S3). A partir da carteira já
 * carregada (`useConsultantClients`) e do id da org na URL, decide qual estado a
 * página do relatório deve mostrar. Sem React — testável isoladamente.
 *
 * O relatório reusa a carteira como fonte do cabeçalho (nome/saúde/patrimônio);
 * as abas com os reads por-org (Visão geral, Transações, Cartões, Categorias)
 * chegam em A3.2+. "Cliente" = org onde o consultor tem membership de assessoria.
 */

/** Cliente da carteira cujo `organization_id` casa com `id` (ou null). */
export function findClientByOrg(clients, id) {
  if (!Array.isArray(clients) || !id) return null;
  return clients.find((c) => c.organization_id === id) ?? null;
}

/**
 * Estado da página do relatório dado o id da URL e o resultado do hook da carteira.
 * Prioridade (espelha `ConsultantClientsPage`): achou o cliente → "ready" (mostra
 * mesmo se um refetch falhou — preserva o último bom); senão ainda carregando →
 * "loading"; erro sem lista → "error"; carregou e não achou → "not_found"
 * (org que não é cliente do consultor, ou id inválido no deep-link).
 */
export function resolveClientReportState({ clients, id, hasLoaded = false, isLoading = false, error = "" } = {}) {
  const client = findClientByOrg(clients, id);
  if (client) return { status: "ready", client };
  if (!hasLoaded || isLoading) return { status: "loading", client: null };
  if (error) return { status: "error", client: null };
  return { status: "not_found", client: null };
}
