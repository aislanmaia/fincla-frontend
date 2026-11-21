// As contagens de "Revisar e concluir", num lugar só: o passo mostra a tabela inteira e a
// confirmação de "Concluir agora" (primeira tela da conta) mostra as mesmas linhas, compactas.
import { plural } from "../../plural.js";
import { isPaidNow } from "./InvoicePaymentStep.jsx";

/** `[rótulo, valor, testId, nota]` de cada contagem do resumo, na ordem do passo. */
export function summaryCountRows(statementImport) {
  const { summary } = statementImport;
  const rows = [
    ["Lançamentos no extrato", summary.total, "summary-total"],
    ["Já estavam no Fincla", summary.to_pair, "summary-to-pair"],
    ["Serão adicionados", summary.to_create, "summary-to-create"],
    ["Somados em um lançamento", summary.grouped, "summary-grouped", summary.groups ? `em ${plural(summary.groups, "transação", "transações")}` : null],
    ["Não serão registrados", summary.ignored, "summary-ignored", summary.left_out_before_start ? `${summary.left_out_before_start.toLocaleString("pt-BR")} antes do início` : null],
    ...(summary.already_reconciled ? [["Já conferidos antes", summary.already_reconciled, "summary-already-reconciled", "não mudam"]] : []),
  ];
  // Só aparece com pagamento de fatura no extrato (fincla-api#512): é a fatura que fica paga.
  if (summary.invoice_payments) rows.push(["Pagamentos de fatura", summary.invoice_payments, "summary-invoice-payments"]);
  // Fatura já paga no Fincla (G3-3-01): só referência, nada muda nela. Conta pelo estado de AGORA
  // (BUG-02), a mesma decisão do cartão: desmarcada depois da leitura, não é "já paga".
  const alreadyPaidNow = statementImport.entries.filter(isPaidNow).length;
  if (alreadyPaidNow) {
    rows.push(["Pagamentos de fatura já paga no Fincla", alreadyPaidNow, "summary-invoices-already-paid-count", "nada muda"]);
  }
  return rows;
}

/** O aviso de Não classificado do resumo, ou `null`. */
export function unclassifiedText(summary) {
  return summary.unclassified ? `${plural(summary.unclassified, "transação vai", "transações vão")} para Não classificado.` : null;
}
