import { T } from "../../tokens";
import { safePctOrFallback as safe } from "../../data/creditCardsAdapter.js";

/**
 * Heurísticas de Score de saúde, Velocidade de gasto e Melhor dia de compra.
 * Moradia única: a aba Análises da tela clássica e o Hub do cartão leem as mesmas
 * funções, então a mesma entrada dá o mesmo número. As ENTRADAS podem diferir:
 * cada tela as monta dos dados que carregou (o Hub, por exemplo, sinaliza com
 * `totalInstallments: null` que a exposição de parcelas é desconhecida). As fórmulas são as que viviam
 * em `CartoesPage` e `AnalyticsTab`, movidas sem alteração.
 */

/** Menos que isso de dados no ciclo e a projeção seria extrapolar de um único dia. */
const MIN_ELAPSED_DAYS_FOR_PACE = 2;

const utcDay = (y, m, day) => Date.UTC(y, m, day) / 86_400_000;

/** Dia de fechamento efetivo do mês (dia 31 em mês de 30 dias fecha no 30). */
function closingDayNumber(year, month0, closingDay) {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return utcDay(year, month0, Math.min(Math.max(1, closingDay), lastDay));
}

/**
 * Ciclo atual do cartão: dias decorridos desde o último fechamento e duração real
 * do ciclo (dias entre dois fechamentos consecutivos). A fatura de um mês fecha
 * ao fim do dia de fechamento, então nesse dia o ciclo ainda é o corrente.
 */
export function computeCycle({ closingDay, today = new Date() }) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const todayDay = utcDay(y, m, today.getDate());
  const closeThis = closingDayNumber(y, m, Number(closingDay) || 1);
  const prevClose = todayDay <= closeThis
    ? closingDayNumber(...(m === 0 ? [y - 1, 11] : [y, m - 1]), Number(closingDay) || 1)
    : closeThis;
  const prevRef = new Date(prevClose * 86_400_000);
  const nextRef = new Date(utcDay(prevRef.getUTCFullYear(), prevRef.getUTCMonth() + 1, 1) * 86_400_000);
  const nextClose = closingDayNumber(nextRef.getUTCFullYear(), nextRef.getUTCMonth(), Number(closingDay) || 1);
  return { elapsedDays: todayDay - prevClose, cycleLength: nextClose - prevClose };
}

const effectiveClosingDay = (card) => card?.closingDayEffective ?? card?.fechamento ?? 1;

export function computeUsagePercent(card) {
  return card ? safe(card.limite - card.disponivel, card.limite) : 0;
}

/** Parcelas futuras comprometidas, líquidas de estornos. */
export function computeInstallmentsExposure(cardInstallments) {
  const list = cardInstallments || [];
  const gross = list.reduce((s, p) => s + p.vParcela * (p.total - p.pago), 0);
  const refunds = list.reduce(
    (s, p) => s + (p.refundsSummary ? Number(p.refundsSummary.totalValue) : 0),
    0,
  );
  return {
    gross,
    refunds,
    net: Math.max(0, gross - refunds),
    hasRefunds: refunds > 0,
  };
}

/** Projeção do fechamento da fatura aberta, ou `null` quando não há dado para projetar. */
export function computeSpendProjection({ card, invoice, isCurrent, today = new Date() }) {
  const spent = Number(invoice?.val);
  if (!(card && isCurrent && Number.isFinite(spent) && spent > 0)) return null;
  const { elapsedDays, cycleLength } = computeCycle({ closingDay: effectiveClosingDay(card), today });
  if (elapsedDays < MIN_ELAPSED_DAYS_FOR_PACE) return null;
  return Math.round((spent / elapsedDays) * cycleLength);
}

export function computeCardKpis({ card, invoice, usagePercent, totalInstallments, projection, today = new Date() }) {
  const { elapsedDays, cycleLength } = computeCycle({ closingDay: effectiveClosingDay(card), today });
  const cycleProgressPercent = safe(elapsedDays, cycleLength);
  const spentPercent = safe((invoice?.val || 0), card.limite);
  const hasPaceData = elapsedDays >= MIN_ELAPSED_DAYS_FOR_PACE && Number(invoice?.val) > 0;
  const onPace = hasPaceData ? spentPercent <= cycleProgressPercent : null;
  // `totalInstallments: null` = exposição de parcelas desconhecida (fatura aberta
  // indisponível): sem ela o score sairia inflado, então não se afirma número.
  const healthKnown = totalInstallments !== null && totalInstallments !== undefined;
  const healthScore = !healthKnown
    ? null
    : card.limite > 0
      ? Math.max(0, 100 - usagePercent - (totalInstallments / card.limite * 30))
      : (usagePercent === 0 ? 100 : 0);
  const healthColor = !healthKnown ? T.inkMid : healthScore >= 70 ? T.green : healthScore >= 40 ? T.amber : T.red;
  const healthLabel = !healthKnown ? "Sem dados ainda" : healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Regular" : "Atenção";
  const bestPurchaseDay = card.fechamento + 1 > 28 ? 1 : card.fechamento + 1;
  return {
    cycleProgressPercent,
    spentPercent,
    hasPaceData,
    onPace,
    projection: hasPaceData ? projection : null,
    healthScore,
    healthColor,
    healthLabel,
    bestPurchaseDay,
    closingDay: card.fechamento,
  };
}
