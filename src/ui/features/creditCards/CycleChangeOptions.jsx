import { useEffect, useState } from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { formatCreditCardsApiError } from "../../data/creditCardsAdapter.js";

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
  const valid = (value) => /^\d{1,2}$/.test(String(value).trim()) && Number(value) >= 1 && Number(value) <= 31;
  if (!valid(dueDay) || !valid(closingDay)) return false;
  return Number(dueDay) !== Number(original.dueDay) || Number(closingDay) !== Number(original.closingDay);
}

/**
 * O que mandar em `apply_from`: a escolha do usuário só quando os dias de fato mudaram, e `undefined`
 * (o backend assume a próxima fatura) quando não. Reescrever o histórico sem confirmação nunca sai.
 */
export function applyFromToSend(original, dueDay, closingDay, applyFrom, confirmRewrite) {
  if (!cycleDaysChanged(original, dueDay, closingDay)) return undefined;
  if (applyFrom === APPLY_FROM.ALL && !confirmRewrite) return APPLY_FROM.NEXT;
  return applyFrom;
}

/**
 * "Desde quando valem os novos dias?" — aparece ao editar vencimento/fechamento de um cartão.
 *
 * A pré-seleção é a opção mais defensiva (próxima fatura): nada do que o banco já emitiu muda sem o
 * usuário pedir. Reescrever o histórico exige uma confirmação explícita.
 */
export function CycleChangeOptions({ applyFrom, setApplyFrom, confirmRewrite, setConfirmRewrite }) {
  // Voltar aos dias originais fecha as opções: a próxima mudança começa de novo, sem herdar uma confirmação antiga.
  useEffect(() => () => {
    setApplyFrom(APPLY_FROM.NEXT);
    setConfirmRewrite(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
            A data de vencimento de todas as faturas e parcelas será reescrita, inclusive as de faturas já pagas. Os valores e o status não mudam.
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

/**
 * Aviso de uma mudança já agendada, com os dias que o cartão passa a seguir.
 *
 * Com `onCancel`, oferece desfazê-la enquanto ela não começou: o cartão segue nos dias atuais e as parcelas das
 * próximas faturas voltam ao vencimento anterior. Pede uma confirmação antes (um toque errado no celular mudaria
 * datas de várias parcelas). `disabled` trava o botão enquanto o formulário salva.
 */
export function ScheduledCycleNotice({ scheduled, onCancel, disabled = false }) {
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  if (!scheduled) return null;
  const blocked = canceling || disabled;
  const cancel = async () => {
    setCanceling(true);
    setError("");
    try {
      await onCancel();
      setConfirming(false);
    } catch (cause) {
      setError(formatCreditCardsApiError(cause));
    } finally {
      setCanceling(false);
    }
  };
  const button = { ...G, minHeight: 40, border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.ink, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.6 : 1 };
  return (
    <div style={{ ...G, fontSize: 11, color: T.inkMid, background: T.grayLight, borderRadius: 9, padding: "9px 12px", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <span>
        Mudança agendada: a partir da fatura de {invoiceLabel(scheduled.year, scheduled.month)}, vence dia {scheduled.dueDay} e fecha dia {scheduled.closingDay}.
        Os campos abaixo mostram os dias da fatura aberta.
      </span>
      {onCancel && !confirming && (
        <button type="button" onClick={() => setConfirming(true)} disabled={blocked} style={{ ...button, alignSelf: "flex-start" }}>
          Cancelar mudança agendada
        </button>
      )}
      {onCancel && confirming && (
        <div role="group" aria-label="Confirmar cancelamento" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span>As parcelas das próximas faturas voltam ao vencimento anterior.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={cancel} disabled={blocked} style={{ ...button, background: T.ink, color: "#fff", borderColor: T.ink }}>
              {canceling ? "Cancelando…" : "Sim, cancelar a mudança"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={blocked} style={button}>Manter</button>
          </div>
        </div>
      )}
      {error && <span role="alert" style={{ color: T.red }}>{error}</span>}
    </div>
  );
}
