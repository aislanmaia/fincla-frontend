// Conciliar fatura, passo 5 "Compras novas" (fincla-api#557).
//
// O mesmo passo do extrato (`NewEntriesStep`, #513/#517): a lista com só o atual aberto, as linhas
// "Adicionar agora"/"Não registrar" com "Conferido", "Alterar" e "Desfazer escolha", o rodapé de
// pendentes. Sem lote e sem soma (a fatura não tem). O cartão aberto é o da fatura: "Na fatura do
// banco" à esquerda e, à direita, o mesmo formulário do item novo (`StatementEntryCard`), com a
// forma de pagamento travada no cartão e as opções da compra parcelada. Respostas: Adicionar · Não
// registrar. Vêm "Adicionar" marcado, com o "Confirmar" ao lado (desligado sem descrição, com o
// motivo ligado por `aria-describedby`); "Não registrar" confirma e recolhe no clique. Fatura já
// paga (decisão 1): Adicionar desligado, com o motivo; vem "Não registrar" a confirmar.
import { Plus } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { CONFIRM_BLOCKED_NOTE, ConfirmAnswerButton, StatementEntryCard, bankDateLabel, useDescriptionDraft } from "./StatementEntryCard.jsx";
import { AnswerSegment, Connector } from "./SuggestedPairsStep.jsx";
import { NewEntriesStep } from "./NewEntriesStep.jsx";
import { InvoiceAmount, InvoiceBankSide, InvoiceStatusBadge, PAID_INVOICE_REASON, invoiceAnswerUnavailable } from "./InvoiceSuggestedStep.jsx";
import { invoiceNewPurchaseForm, newPurchaseOutcome } from "./InvoiceNewPurchase.jsx";
import { createdInstallments, isInvoiceEntryAnswered, pad2 } from "./invoiceSteps.js";

const QUESTION = "O que fazer com esta compra?";

const ANSWERS = [
  { value: "create", label: "Adicionar", tone: T.green },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];

/**
 * O cartão aberto de uma compra nova. `onChange(id, change)` grava (o "Não registrar" minimiza
 * quando o backend aceita); `onConfirm(entry)` confirma e minimiza; clicar de novo na resposta já
 * marcada confirma também (o "Não registrar" a confirmar de uma fatura paga).
 */
function InvoiceNewPurchaseCard({ entry, form, isMobile, busy, onChange, onConfirm }) {
  const desc = useDescriptionDraft(entry, onChange);
  const skipped = entry.answer === "ignore";
  const blank = !desc.value.trim();
  const choose = (value) => {
    if (busy) return;
    if (value === entry.answer) {
      // A resposta marcada: "Adicionar" confirma pelo Confirmar (grava a descrição); "Não registrar" já.
      if (value === "create") {
        if (!blank) desc.confirm(onConfirm);
      } else onConfirm(entry);
      return;
    }
    // "Adicionar" deixa o formulário aberto para conferir, com o Confirmar; nada fica confirmado ainda.
    onChange(entry.id, value === "create" ? { answer: "create", confirmed: false } : { answer: value });
  };
  const confirm = entry.answer === "create" ? (
    <ConfirmAnswerButton
      disabled={busy || blank}
      blockedNote={blank ? CONFIRM_BLOCKED_NOTE : ""}
      touch={isMobile}
      onConfirm={() => desc.confirm(onConfirm)}
    />
  ) : null;
  return (
    <article
      data-testid="new-purchase-card"
      aria-label={`Compra de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.confirmed ? T.border : T.green}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <InvoiceStatusBadge entry={entry} />
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <InvoiceBankSide entry={entry} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <StatementEntryCard
            entry={entry}
            categories={form.categories}
            details={form.details}
            fallbackLabel={form.fallbackLabel}
            isMobile={isMobile}
            onChange={onChange}
            embedded
            desc={desc}
            skipped={skipped}
            invoice={invoiceNewPurchaseForm(entry, form.cardName, onChange)}
          />
        </div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerSegment
          label={QUESTION}
          answers={ANSWERS}
          value={entry.answer}
          busy={busy}
          unavailable={(a) => invoiceAnswerUnavailable(entry, a.value)}
          onAnswer={choose}
          confirm={confirm}
          note={entry.value_locked ? PAID_INVOICE_REASON : null}
          touch={isMobile}
        />
      </footer>
      <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
        <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>
        {skipped ? <>Não entra no Fincla. A diferença aparece em Conferir o total.</> : newPurchaseOutcome(entry, form)}
      </p>
    </article>
  );
}

/** A linha recolhida de uma parcelada diz quantas parcelas entram ("6 parcelas, 01 a 06"). */
function installmentsDetail(entry) {
  const created = createdInstallments(entry);
  if (!created.length) return null;
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <Plus size={11} aria-hidden="true" />
      <span style={NUM}>{created.length} parcelas, {pad2(created[0].number)} a {pad2(created.at(-1).number)}</span>
    </span>
  );
}

/**
 * O passo "Compras novas". `form` = { categories, details, fallbackLabel, cardName, invoiceMonth };
 * `onChangeEntry(id, body, { onSaved })` grava (devolve `false` quando não gravou); `onConfirmEntry`
 * grava a confirmação antes de recolher.
 */
export function InvoiceNewStep({ entries, queue, form, isMobile, answering, onChangeEntry, onConfirmEntry }) {
  return (
    <NewEntriesStep
      stepKey="new"
      entries={entries}
      groups={[]}
      categories={form.categories}
      details={form.details}
      fallbackLabel={form.fallbackLabel}
      isMobile={isMobile}
      queue={queue}
      answering={answering}
      onChangeEntry={onChangeEntry}
      onBatch={async () => null}
      onCreateGroup={async () => null}
      onUpdateGroup={async () => null}
      onDeleteGroup={async () => null}
      selectable={false}
      trackConfirmed
      answered={isInvoiceEntryAnswered}
      onConfirmEntry={onConfirmEntry}
      createUnavailable={(entry) => invoiceAnswerUnavailable(entry, "create")}
      rowDetail={installmentsDetail}
      rowAmount={(entry) => <InvoiceAmount amount={entry.amount} currency={entry.currency} />}
      renderCard={(entry, { busy, onChange, onConfirm }) => (
        <InvoiceNewPurchaseCard
          entry={entry}
          form={form}
          isMobile={isMobile}
          busy={busy}
          onChange={onChange}
          onConfirm={onConfirm}
        />
      )}
    />
  );
}
