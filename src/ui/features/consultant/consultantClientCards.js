import { safePctOrFallback } from "../../data/creditCardsAdapter.js";

/**
 * Modelo puro da aba "Cartões" do relatório do cliente (RF.3, S3), fiel à
 * referência (`consultor/cons-relatorio-detail.jsx` → `CartoesTab`). Recebe os
 * cartões já mapeados pelo `creditCardsAdapter` (`listCreditCardsForUi`, o mesmo
 * caminho da página de cartões do cliente — resolve a fatura em aberto pelo ciclo
 * de fechamento e garante números idênticos aos que o cliente vê) e projeta só os
 * campos que o visual precisa: visual do cartão, uso do limite e itens da fatura
 * corrente. Sem React.
 */

/** Rótulo de parcelas " · n/tx" (vazio quando à vista/ausente). */
export function installmentsLabel(parcela) {
  if (!parcela || !parcela.t || parcela.t <= 1) return "";
  return ` · ${parcela.n}/${parcela.t}x`;
}

/** Projeta um cartão do adapter para a view da aba (visual + limite + itens). */
export function toCardView(card) {
  const limit = Number(card.limite) || 0;
  const available = Number(card.disponivel) || 0;
  const used = Math.max(0, limit - available);
  const invoice = card?.analytics?.currentInvoice || null;
  return {
    id: String(card.id),
    name: card.nome,
    last4: card.dig,
    brand: card.bandeira,
    dueDay: card.vencimento,
    closingDay: card.fechamento,
    gradient: [card.cor1, card.cor2],
    invoiceTotal: Number(invoice?.total_amount) || 0,
    usagePct: safePctOrFallback(used, limit),
    available,
    limit,
    items: (card.itens || []).map((it) => ({
      id: it.id,
      desc: it.desc,
      dateLabel: it.data,
      installments: installmentsLabel(it.parcela),
      icon: it.icon,
      color: it.catColor,
      value: Number(it.val) || 0,
      isRefund: !!it.isRefund,
    })),
  };
}

/** Mapeia a lista de cartões do adapter para as views da aba. */
export function selectClientCards(cards) {
  return (Array.isArray(cards) ? cards : []).map(toCardView);
}
