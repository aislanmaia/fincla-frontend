// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17).

/**
 * Para onde o atalho leva. `accounts` = contas que aceitam "Importar extrato" (as ativas da
 * organização; cartão de crédito não é conta). `filteredIds` = contas do filtro da tela.
 * - exatamente UMA conta elegível filtrada → direto para ela;
 * - a organização tem UMA conta elegível → direto para ela, mesmo sem filtro;
 * - senão → menu para escolher; sem conta elegível → `null` (sem atalho).
 */
export function shortcutTarget({ accounts, filteredIds }) {
  if (!accounts.length) return null;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const filtered = [...new Set(filteredIds)].filter((id) => byId.has(id));
  if (filtered.length === 1) return { kind: "direct", account: byId.get(filtered[0]) };
  if (accounts.length === 1) return { kind: "direct", account: accounts[0] };
  return { kind: "menu" };
}

/** O rascunho de cada conta: com vários, o de atividade mais recente. */
export function latestDraftByAccount(drafts) {
  const byAccount = {};
  for (const d of drafts) {
    if (d.status && d.status !== "draft") continue;
    const cur = byAccount[d.account_id];
    if (!cur || String(d.last_activity_at ?? "") > String(cur.last_activity_at ?? "")) byAccount[d.account_id] = d;
  }
  return byAccount;
}

/**
 * Até quando foi a última conciliação concluída (que não foi desfeita): o MAIOR fim de período, a
 * mesma regra da dica do envio. `null` sem concluída.
 */
export function latestConcludedEnd(items) {
  const ends = items.filter((i) => i.status === "concluded" && i.period?.end).map((i) => i.period.end);
  return ends.length ? ends.sort().at(-1) : null;
}
