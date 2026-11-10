/**
 * O dinheiro reservado nas metas, lido contra o saldo da Visão Geral.
 *
 * Todo aporte sai de algum lugar (Owner, 2026-11-05): o que fica na mesma conta é
 * RESERVA — o saldo continua batendo com o banco, mas aquela parte é compromisso com
 * uma meta. A tela abre pelo que dá para gastar: disponível = total − reservado.
 *
 * Só desconta o que está na MESMA moeda do total. Moeda do total desconhecida, leitura
 * de reserva que falhou, ou nada reservado: `null`, e a tela fica como sempre foi —
 * inventar um disponível seria pior que não mostrar (ausência nunca vira zero).
 */
export function reserveView(balanceSummary, reservedSummary) {
  const total = balanceSummary?.total_available;
  const currency = balanceSummary?.consolidation?.target_currency;
  if (typeof total !== "number" || !currency || !reservedSummary) return null;
  const reserved = (reservedSummary.totals || [])
    .filter((t) => t.currency === currency)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  if (!(reserved > 0)) return null;
  const goals = (reservedSummary.by_goal || []).filter((g) => g.currency === currency && Number(g.amount) > 0);
  const elsewhere = (reservedSummary.totals || []).filter((t) => t.currency !== currency && Number(t.amount) > 0);
  return {
    currency,
    total,
    reserved,
    free: total - reserved,
    goalCount: goals.length,
    goals,
    elsewhere,
  };
}
