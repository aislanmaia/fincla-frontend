import { T } from "../../tokens";
import { G } from "../../typography";

export const APPLY_FROM = {
  NEXT: "next_invoice",
  OPEN: "open_invoice",
  ALL: "all_history",
};

const OPTIONS = [
  {
    value: APPLY_FROM.NEXT,
    title: "A partir da próxima fatura",
    hint: "A fatura aberta e as anteriores continuam como estão. É assim que o banco aplica a mudança.",
  },
  {
    value: APPLY_FROM.OPEN,
    title: "A partir da fatura aberta",
    hint: "A fatura aberta já usa os novos dias; as anteriores não mudam.",
  },
  {
    value: APPLY_FROM.ALL,
    title: "Corrigir todo o histórico",
    hint: "Só se os dias estavam cadastrados errado. Reescreve o vencimento de todas as faturas e parcelas.",
  },
];

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "dez/2026" para a fatura que fecha em `month`/`year`. */
export function invoiceLabel(year, month) {
  return `${MONTHS[month - 1]}/${year}`;
}

/** O dia mudou de verdade? Dias em branco ou inválidos nunca contam como mudança. */
export function cycleDaysChanged(original, dueDay, closingDay) {
  if (!original) return false;
  const due = Number(dueDay);
  const closing = Number(closingDay);
  if (!Number.isInteger(due) || !Number.isInteger(closing)) return false;
  return due !== Number(original.dueDay) || closing !== Number(original.closingDay);
}

/**
 * "Desde quando valem os novos dias?" — aparece ao editar vencimento/fechamento de um cartão.
 *
 * A pré-seleção é a opção mais defensiva (próxima fatura): nada do que o banco já emitiu muda sem o
 * usuário pedir. Reescrever o histórico exige uma confirmação explícita.
 */
export function CycleChangeOptions({ applyFrom, setApplyFrom, confirmRewrite, setConfirmRewrite, hasPaidInvoices }) {
  const choose = (value) => {
    setApplyFrom(value);
    if (value !== APPLY_FROM.ALL) setConfirmRewrite(false);
  };
  return (
    <fieldset style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", margin: 0, minWidth: 0 }}>
      <legend style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", padding: "0 6px" }}>
        Os novos dias valem
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map((option) => (
          <label key={option.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="radio"
              name="cycle-apply-from"
              value={option.value}
              checked={applyFrom === option.value}
              onChange={() => choose(option.value)}
              style={{ marginTop: 3 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ ...G, display: "block", fontSize: 13, fontWeight: 700, color: T.ink }}>{option.title}</span>
              <span style={{ ...G, display: "block", fontSize: 11, color: T.inkMid, lineHeight: 1.5 }}>{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {applyFrom === APPLY_FROM.ALL && (
        <div style={{ marginTop: 12, background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 9, padding: "10px 12px" }}>
          <div role="alert" style={{ ...G, fontSize: 11, color: T.red, lineHeight: 1.55 }}>
            {hasPaidInvoices
              ? "Este cartão tem faturas já pagas: a data de vencimento delas também será reescrita. Os valores e o status não mudam."
              : "A data de vencimento de todas as faturas e parcelas será reescrita. Os valores e o status não mudam."}
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={confirmRewrite} onChange={(e) => setConfirmRewrite(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ ...G, fontSize: 11, color: T.ink, lineHeight: 1.5 }}>Entendo que isso altera faturas já emitidas.</span>
          </label>
        </div>
      )}
    </fieldset>
  );
}

/** Aviso de uma mudança já agendada, com os dias que o cartão passa a seguir. */
export function ScheduledCycleNotice({ scheduled }) {
  if (!scheduled) return null;
  return (
    <div style={{ ...G, fontSize: 11, color: T.inkMid, background: T.grayLight, borderRadius: 9, padding: "9px 12px", lineHeight: 1.55 }}>
      Mudança agendada: a partir da fatura de {invoiceLabel(scheduled.year, scheduled.month)}, vence dia {scheduled.dueDay} e fecha dia {scheduled.closingDay}.
      Os campos abaixo mostram os dias da fatura aberta.
    </div>
  );
}
