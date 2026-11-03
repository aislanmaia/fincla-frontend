/**
 * Wording for settling (paying / receiving) a single transaction.
 *
 * "Marcar como pago" is expense vocabulary: nobody "pays" a salary they are
 * owed. An income settles by being RECEIVED, so it gets its own words; every
 * other type keeps the paying wording it always had.
 *
 * Refunds (`type === "refund"`) deliberately stay on the expense wording for now:
 * the Owner only decided the income case.
 *
 * Accepts the API type (`"income"`) or the modal's own `"receita"`.
 */
const EXPENSE = {
  settledToggle: "Já paguei",
  pendingToggle: "Ainda não paguei",
  pendingHint: "Fica como compromisso pendente.",
  markAria: (desc) => `Marcar ${desc} como pago`,
  undoAria: (desc) => `Desfazer pagamento de ${desc}`,
  markShort: "Pagar",
  markButton: "✓ Marcar como pago",
  undoButton: "↺ Desfazer pagamento",
  pendingBadge: "A pagar",
  confirmSettleTitle: "Marcar como paga?",
  confirmSettleButton: "✓ Confirmar pagamento",
  confirmUnsettleTitle: "Desfazer este pagamento?",
  confirmUnsettleButton: "↺ Desfazer pagamento",
};

const INCOME = {
  settledToggle: "Já recebi",
  pendingToggle: "Ainda não recebi",
  pendingHint: "Fica como valor a receber.",
  markAria: (desc) => `Marcar ${desc} como recebido`,
  undoAria: (desc) => `Desfazer recebimento de ${desc}`,
  markShort: "Receber",
  markButton: "✓ Marcar como recebido",
  undoButton: "↺ Desfazer recebimento",
  pendingBadge: "A receber",
  confirmSettleTitle: "Marcar como recebida?",
  confirmSettleButton: "✓ Confirmar recebimento",
  confirmUnsettleTitle: "Desfazer este recebimento?",
  confirmUnsettleButton: "↺ Desfazer recebimento",
};

export function settlementCopy(type) {
  return type === "income" || type === "receita" ? INCOME : EXPENSE;
}
