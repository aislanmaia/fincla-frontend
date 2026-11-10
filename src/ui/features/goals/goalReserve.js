/**
 * O dinheiro reservado nas metas, lido contra o saldo da Visão Geral.
 *
 * Todo aporte sai de algum lugar (Owner, 2026-11-05): o que fica na mesma conta é
 * RESERVA — o saldo continua batendo com o banco, mas aquela parte é compromisso com
 * uma meta. A tela abre pelo que dá para gastar: disponível = total − reservado.
 *
 * O reservado só sai do total que o CONTÉM: conta fora do total não entra (o total
 * nunca teve aquele dinheiro), e reserva em outra moeda é convertida pela MESMA cotação
 * que consolidou o total — o recibo vem junto. Faltou algo para afirmar o número
 * (moeda do total, contas, cotação, a própria leitura): `null`, e a tela fica como
 * sempre foi. Ausência nunca vira zero.
 */
export function reserveView(balanceSummary, reservedSummary, includedAccountIds) {
  const total = balanceSummary?.total_available;
  const target = balanceSummary?.consolidation?.target_currency;
  if (typeof total !== "number" || !target || !reservedSummary || !includedAccountIds) return null;
  const rates = balanceSummary?.consolidation?.rates || [];

  let reserved = 0;
  for (const row of reservedSummary.by_account || []) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0 || !row.account_id || !includedAccountIds.has(row.account_id)) continue;
    if (row.currency === target) {
      reserved += amount;
      continue;
    }
    const rate = rates.find((r) => r.base === row.currency && r.quote === target);
    if (!rate || !Number.isFinite(Number(rate.rate))) return null;
    reserved += amount * Number(rate.rate);
  }
  reserved = Math.round(reserved * 100) / 100;
  if (!(reserved > 0)) return null;

  const goals = (reservedSummary.by_goal || []).filter((g) => Number(g.amount) > 0);
  return { currency: target, total, reserved, free: total - reserved, goalCount: goals.length, goals };
}

/** Largura da fatia livre na barra (0–100). */
export const freeShare = (total, free) => (total > 0 ? Math.max(0, Math.min(100, (free / total) * 100)) : 0);
