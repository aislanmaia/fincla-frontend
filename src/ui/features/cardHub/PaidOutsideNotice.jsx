import { T } from "../../tokens";
import { G } from "../../typography";

/** Efeito do registro e aviso de duplicidade, mostrados junto da data de uma fatura vencida. */
export function PaidOutsideNotice({ undoHint = false }) {
  return (
    <div data-testid="paid-outside-notice" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, lineHeight: 1.45, color: T.inkMid, minWidth: 0 }}>
      <span>Isso só registra o pagamento no Fincla: nenhuma cobrança é feita. O valor passa a sair do seu saldo na data escolhida e o limite do cartão é liberado.</span>
      <span style={{ color: T.ink }}>Se você já lançou esse pagamento como despesa, não marque aqui para não contar duas vezes.</span>
      {undoHint && <span>Errou? Você pode desfazer o pagamento no dashboard da fatura.</span>}
    </div>
  );
}
