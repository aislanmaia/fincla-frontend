import {
  buildEditBaselineFromUi,
  modalPaymentKeyFromTransactionUi,
  editDateIso,
  transactionUiValAbsForEdit,
} from "../../data/transactionsAdapter.js";

/**
 * Pré-preenchimento do modal de transação a partir de uma linha da lista.
 *
 * Extraído porque editar e duplicar precisam EXATAMENTE do mesmo mapeamento —
 * duas cópias divergiriam num campo qualquer e só a duplicação sairia errada,
 * silenciosamente.
 */
export function buildTxModalPreConfig(tx) {
  const txMethod = modalPaymentKeyFromTransactionUi(tx);
  const isParcelado = tx.parcela && tx.parcela.total > 1;
  // Refund: tx.val é positivo mas o tipo no domínio é 'refund' → drawer abre na
  // aba Despesa com toggle estorno ON.
  let tipoForModal;
  if (tx.type === "refund") tipoForModal = "despesa";
  else if (tx.type === "income" || tx.val > 0) tipoForModal = "receita";
  else tipoForModal = "despesa";
  return {
    tipo: tipoForModal,
    isEstorno: tx.type === "refund",
    desc: tx.desc,
    cat: tx.cat,
    categoryTagId: tx.categoryTagId ?? null,
    // Categoria apagada: sem isto o formulário não a acha entre as ativas e a troca em silêncio pela primeira.
    categoryTagIsActive: tx.categoryTagIsActive !== false,
    method: txMethod,
    valorInicial: transactionUiValAbsForEdit(tx),
    recorre: tx.rec,
    editingTransactionId: tx.id,
    dateIso: editDateIso(tx),
    // Vencimento da parcela, mostrado à parte: o campo de data passa a ser o da compra.
    dueDateLabel: tx.purchaseDateIso ? tx.parcela?.vencimento ?? null : null,
    cartaoId: tx.cartaoId != null ? tx.cartaoId : undefined,
    modalidade: txMethod === "credito" ? (isParcelado ? "parcelado" : "avista") : undefined,
    parcelas: isParcelado ? tx.parcela.total : undefined,
    tags: tx.tags ?? [],
    detailTagIds: tx.detailTagIds ?? [],
    detailTagDisplayById: tx.detailTagDisplayById ?? {},
    refundOfTransactionId: tx.refundOfTransactionId ?? null,
    // A lista traz a transação inteira, então o baseline nasce aqui: este
    // caminho curto-circuita o fetch de hidratação (`hasEditorPayload`) e sem
    // isso o submit voltaria a mandar o pacote cheio.
    editBaseline: buildEditBaselineFromUi(tx),
  };
}
