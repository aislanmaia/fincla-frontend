import { T } from "../../tokens";
import { safePctOrFallback as safe } from "../../data/creditCardsAdapter.js";

/**
 * Heurísticas de Score de saúde, Velocidade de gasto e Melhor dia de compra.
 * Moradia única: a aba Análises da tela clássica e o Hub do cartão leem daqui,
 * então os dois mostram sempre o mesmo número. As fórmulas são as que viviam
 * em `CartoesPage` e `AnalyticsTab`, movidas sem alteração.
 */

/** Dia do mês assumido pela heurística de ritmo (valor herdado, não é o dia real). */
export const KPI_TODAY_DAY = 18;
const KPI_DAYS_IN_MONTH = 30;

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

export function computeSpendProjection({ card, invoice, isCurrent }) {
  const invoiceVal = (invoice?.val || 0) || 0;
  if (!(card && isCurrent && KPI_TODAY_DAY > 0 && invoiceVal > 0)) return 0;
  return Math.round(
    (invoiceVal / KPI_TODAY_DAY) *
      (card.vencimento > card.fechamento
        ? card.vencimento - card.fechamento
        : 30 + card.vencimento - card.fechamento),
  );
}

export function computeCardKpis({ card, invoice, usagePercent, totalInstallments, projection }) {
  const monthProgressPercent = safe(KPI_TODAY_DAY, KPI_DAYS_IN_MONTH);
  const spentPercent = safe((invoice?.val || 0), card.limite);
  const onPace = spentPercent <= monthProgressPercent;
  const healthScore = card.limite > 0
    ? Math.max(0, 100 - usagePercent - (totalInstallments / card.limite * 30))
    : (usagePercent === 0 ? 100 : 0);
  const healthColor = healthScore >= 70 ? T.green : healthScore >= 40 ? T.amber : T.red;
  const healthLabel = healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Regular" : "Atenção";
  const bestPurchaseDay = card.fechamento + 1 > 28 ? 1 : card.fechamento + 1;
  return {
    monthProgressPercent,
    spentPercent,
    onPace,
    projection,
    healthScore,
    healthColor,
    healthLabel,
    bestPurchaseDay,
    closingDay: card.fechamento,
  };
}
