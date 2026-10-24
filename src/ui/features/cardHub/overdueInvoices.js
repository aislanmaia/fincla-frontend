import { formatMoney } from "../../money/formatMoney.js";
import { invoiceDashboardPath } from "../../routing/invoiceRoute.js";
import { parseInvoiceKey } from "./hubInvoices.js";
import { PAID_OUTSIDE_LABEL } from "./paidOutside.jsx";

export const OVERDUE_INSIGHT_TYPE = "overdue_invoices";

/** "R$ 100,00" para uma moeda; "R$ 100,00 + € 20,00" para várias: moedas nunca são somadas. */
function describeOverdueAmount(summary) {
  if (summary.total_amount) return formatMoney(summary.total_amount.amount, summary.total_amount.currency);
  if (summary.by_currency.length === 0) return null;
  return summary.by_currency.map((part) => formatMoney(part.amount, part.currency)).join(" + ");
}

/**
 * Insight do Hub para as faturas vencidas da organização, ou `null` quando não há nenhuma.
 * O link leva à fatura mais atrasada (a primeira de `items`); sem o cartão carregado, o insight
 * continua valendo, só sem link.
 */
export function buildOverdueInsight(summary, cards) {
  if (!summary || !(summary.count > 0)) return null;
  const amount = describeOverdueAmount(summary);
  const noun = summary.count === 1 ? "fatura vencida" : "faturas vencidas";
  const message = `Você tem ${summary.count} ${noun}${amount ? ` — ${amount}` : ""}`;
  const first = summary.items[0];
  const publicId = first ? cards.find((card) => card.id === first.credit_card_id)?.public_id : null;
  const ref = first ? parseInvoiceKey(first.month) : null;
  const href = publicId && ref ? invoiceDashboardPath(publicId, ref.year, ref.month) : null;
  return { type: OVERDUE_INSIGHT_TYPE, message, href, actionLabel: href ? PAID_OUTSIDE_LABEL : null };
}
