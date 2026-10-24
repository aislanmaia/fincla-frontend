import { T } from "../../tokens";
import { G } from "../../typography";

/** Ação para quem pagou a fatura vencida fora do Fincla: só registra o pagamento, não movimenta dinheiro. */
export const PAID_OUTSIDE_LABEL = "Já paguei — marcar como paga";

const YMD = /^\d{4}-\d{2}-\d{2}/;

/** Data pré-selecionada ao registrar o pagamento de uma fatura vencida: o vencimento, nunca depois de hoje. */
export function defaultPaidDate(dueDate, today) {
  const due = YMD.test(String(dueDate ?? "")) ? String(dueDate).slice(0, 10) : null;
  return due && due <= today ? due : today;
}

/** Efeito do registro e aviso de duplicidade, mostrados junto da data de uma fatura vencida. */
export function PaidOutsideNotice({ undoHint = false }) {
  return (
    <div data-testid="paid-outside-notice" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, lineHeight: 1.45, color: T.inkMid, minWidth: 0 }}>
      <span>Isso só registra o pagamento no Fincla; nenhum dinheiro é movimentado. O valor sai do seu saldo na data escolhida e o limite do cartão é liberado.</span>
      <span style={{ color: T.ink }}>Se você já lançou esse pagamento como despesa, não marque aqui para não contar duas vezes.</span>
      {undoHint && <span>Errou? Você pode desfazer o pagamento no dashboard da fatura.</span>}
    </div>
  );
}
