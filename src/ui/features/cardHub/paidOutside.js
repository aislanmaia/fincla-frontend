/** Ação para quem pagou a fatura vencida fora do Fincla: só registra o pagamento, não movimenta dinheiro. */
export const PAID_OUTSIDE_LABEL = "Já paguei — marcar como paga";

const YMD = /^\d{4}-\d{2}-\d{2}/;

/** Data pré-selecionada ao registrar o pagamento de uma fatura vencida: o vencimento, nunca depois de hoje. */
export function defaultPaidDate(dueDate, today) {
  const due = YMD.test(String(dueDate ?? "")) ? String(dueDate).slice(0, 10) : null;
  return due && due <= today ? due : today;
}
