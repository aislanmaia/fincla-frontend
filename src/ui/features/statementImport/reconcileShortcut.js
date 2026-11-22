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

/**
 * O chip do CELULAR entre a busca e a lista (decisão do Owner de 2026-11-22). `target` vem de
 * `shortcutTarget`; `draftByAccount` é `null` enquanto os rascunhos não chegaram (ou falharam): sem
 * chip, nunca um número inventado.
 * - destino direto com rascunho → `continue` (M1b) para ele;
 * - dois ou mais rascunhos nas contas elegíveis (sem destino direto, ou o destino direto sem
 *   rascunho) → `many` (M3), na ordem das contas;
 * - sem destino direto e exatamente um rascunho → `continue` para ele;
 * - o resto (nada começado; ou conta filtrada sem rascunho e só UMA outra com) → `null` (M2: o
 *   atalho fica só no menu ⋯). Com a tela filtrada por uma conta, o chip não leva a outra conta.
 */
export function mobileShortcutChip({ target, accounts, draftByAccount }) {
  if (!target || !draftByAccount) return null;
  if (target.kind === "direct") {
    const draft = draftByAccount[target.account.id];
    if (draft) return { kind: "continue", account: target.account, draft };
  }
  const started = accounts.filter((a) => draftByAccount[a.id]).map((a) => ({ account: a, draft: draftByAccount[a.id] }));
  if (started.length >= 2) return { kind: "many", started };
  if (target.kind === "menu" && started.length === 1) return { kind: "continue", ...started[0] };
  return null;
}
