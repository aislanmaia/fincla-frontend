import { formatYmdToBrDisplay, pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { categoryLabelPtForTag } from "../../data/categoryLabels.js";
import { fmtValorDaLinha } from "../transactions/shared/transactionFormat.js";
import { installmentOf } from "./ledgerModel.js";

/**
 * A linha do extrato do cartão (formato da API) no formato que `ConfirmActionModal`/`ConfirmActionInline`
 * de /transactions leem: o mesmo cartão da transação e o mesmo aviso de compra parcelada — excluir uma
 * parcela apaga a compra inteira, então o total vai junto.
 */
export function deleteConfirmTx(row, cardCurrency = null) {
  const currency = row.value_currency || cardCurrency || null;
  const part = installmentOf(row);
  const perInstallment = Math.abs(Number(part?.amount ?? row.value) || 0);
  return {
    id: row.id,
    icon: row.type === "refund" ? "↩" : "▤",
    desc: row.description,
    date: formatYmdToBrDisplay(String(row.date ?? "").slice(0, 10)) || null,
    // O nome que a organização deu à categoria vem primeiro, como no resto do app.
    cat: (() => { const tag = pickCategoryTagFromApiTransaction(row); return (tag && (tag.custom_name || tag.label || categoryLabelPtForTag(tag))) || row.category || null; })(),
    method: "Cartão de crédito",
    type: row.type,
    // Sem moeda conhecida o valor fica "—", como na tabela: nunca inventar real para um valor de moeda desconhecida.
    valorFormatado: currency ? fmtValorDaLinha(Math.abs(Number(row.value) || 0), currency) : "—",
    parcela: part && part.total_installments > 1
      ? { total: part.total_installments, atual: part.installment_number, valorTotal: currency ? Math.round(perInstallment * part.total_installments * 100) / 100 : null }
      : null,
    currency,
  };
}
