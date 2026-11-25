// Conciliar fatura, #561: "Ajustar também as próximas N parcelas com os valores que o banco informou
// na fatura". Num par com "Valor diferente" numa parcela com seguintes, o banco listou todas
// ("Compras parceladas – próximas faturas"): a caixa vem marcada, a lista mostra cada parcela (de → para)
// e, desmarcada, o aviso de quanto o total da compra fica diferente do banco. Marcar ou desmarcar grava
// na hora (`adjust_next_installments`) sem recolher o cartão; nada muda no Fincla antes de concluir.
import { createContext, useContext } from "react";
import { ArrowRight, Info } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { useTouchTarget } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { adjustableInstallments, invoiceMonthLabel } from "./invoiceSteps.js";

/**
 * Quem grava a caixa: a tela provê `{ onToggle(entry, adjust), busy }`. Sem provedor (leitura), a
 * caixa fica desligada.
 */
export const NextAdjustmentContext = createContext(null);

/** Por que a parcela fica com o valor do Fincla mesmo com a caixa marcada. */
export const LOCKED_REASON = {
  invoice_paid: "fatura já paga: fica com o valor do Fincla",
  reconciled: "já conferida",
};

const pad = (n) => String(n).padStart(2, "0");
const money = (value) => (value ? formatMoney(Math.abs(value.amount), value.currency) : "não sabemos");

function InstallmentLine({ item, count, adjust }) {
  const reason = item.locked ? LOCKED_REASON[item.locked] ?? "fica com o valor do Fincla" : null;
  const changes = adjust && !item.locked;
  return (
    <li data-testid="next-adjustment-installment" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...NUM, fontWeight: 600, color: T.ink }}>{pad(item.number)}/{pad(count)}</span>
      <span style={{ color: T.inkLight }}>· {item.invoice ? invoiceMonthLabel(item.invoice) : "fatura: não sabemos"} ·</span>
      {changes ? (
        <>
          <s style={{ ...NUM, color: T.inkLight }}>{money(item.from)}</s>
          <ArrowRight size={12} aria-hidden="true" />
          <b style={NUM}>{money(item.to)}</b>
        </>
      ) : (
        <span style={NUM}>{money(item.from)}</span>
      )}
      {reason ? <span style={{ color: T.amber }}>({reason})</span> : null}
    </li>
  );
}

/** A caixa, a lista e, desmarcada, o aviso. `entry.next_adjustment` precisa existir. */
export function NextAdjustment({ entry }) {
  const ctx = useContext(NextAdjustmentContext);
  const touch = useTouchTarget();
  const adjustment = entry.next_adjustment;
  const count = entry.installment?.count ?? entry.fincla_transaction?.installment?.count ?? 0;
  const n = adjustableInstallments(adjustment).length;
  const disabled = !ctx || ctx.busy;
  const diff = adjustment.purchase_difference;
  let warning = null;
  if (!adjustment.adjust) {
    warning = diff === null
      ? <>O total da compra no Fincla fica diferente do banco.</>
      : Math.abs(diff.amount) >= 0.005
        ? <>O total da compra no Fincla fica <b style={NUM}>{money(diff)}</b> diferente do banco.</>
        : null;
  }
  return (
    // Acima do botão que cobre a caixa da sugestão intacta: marcar aqui não confirma o par.
    <div data-testid="next-adjustment" style={{ ...G, position: "relative", zIndex: 1, fontSize: 12, color: T.inkMid, marginTop: 8 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: disabled ? "default" : "pointer", ...touch }}>
        <input
          type="checkbox"
          checked={adjustment.adjust}
          disabled={disabled}
          onChange={(e) => ctx?.onToggle(entry, e.target.checked)}
          style={{ margin: 0, width: 16, height: 16, flexShrink: 0 }}
        />
        <span>
          Ajustar também as próximas {n ? plural(n, "parcela", "parcelas") : "parcelas"} com os valores que o banco informou na fatura
        </span>
      </label>
      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: "0 0 0 24px", display: "flex", flexDirection: "column", gap: 2 }}>
        {adjustment.installments.map((item) => (
          <InstallmentLine key={item.number} item={item} count={count} adjust={adjustment.adjust} />
        ))}
      </ul>
      {warning ? (
        <p data-testid="next-adjustment-warning" style={{ margin: "6px 0 0", display: "flex", gap: 6, alignItems: "baseline", color: T.amber }}>
          <Info size={13} aria-hidden="true" style={{ flexShrink: 0, alignSelf: "center" }} />
          <span>{warning}</span>
        </p>
      ) : null}
    </div>
  );
}
