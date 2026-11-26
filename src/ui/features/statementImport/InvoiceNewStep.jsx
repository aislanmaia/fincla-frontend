// Conciliar fatura, passo 5 "Compras novas" (fincla-api#557).
//
// O mesmo passo do extrato (`NewEntriesStep`, #513/#517): a lista com só o atual aberto, as linhas
// "Adicionar agora"/"Não registrar" com "Conferido", "Alterar" e "Desfazer escolha", o rodapé de
// pendentes. Sem lote e sem soma (a fatura não tem). O cartão aberto é o da fatura: "Na fatura do
// banco" à esquerda e, à direita, o mesmo formulário do item novo (`StatementEntryCard`), com a
// forma de pagamento travada no cartão e as opções da compra parcelada. Respostas: Adicionar · Não
// registrar. Vêm "Adicionar" marcado, com o "Confirmar" ao lado (desligado sem descrição, com o
// motivo ligado por `aria-describedby`); "Não registrar" confirma e recolhe no clique. Fatura já
// paga (decisão 1) ou crédito parcelado: Adicionar desligado, com o motivo (`aria-describedby`); vem
// "Não registrar" a confirmar.
//
// O passo 4 "Encargos, tarifas e estornos" (fincla-api#558) usa o mesmo passo para a anuidade, a
// redução, o repasse de IOF e os estornos ("Adicionar" com o formulário; crédito vira estorno, com
// a nota), com o grupo de encargos no topo da mesma fila (`leading`).
import { Plus } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { CONFIRM_BLOCKED_NOTE, ConfirmAnswerButton, StatementEntryCard, bankDateLabel, useDescriptionDraft } from "./StatementEntryCard.jsx";
import { AnswerSegment, Connector } from "./SuggestedPairsStep.jsx";
import { NewEntriesStep } from "./NewEntriesStep.jsx";
import { InvoiceAmount, InvoiceBankSide, InvoiceStatusBadge, invoiceAnswerNote, invoiceAnswerUnavailable } from "./InvoiceSuggestedStep.jsx";
import { invoiceNewPurchaseForm, newPurchaseOutcome } from "./InvoiceNewPurchase.jsx";
import { createdInstallments, isInvoiceEntryAnswered, pad2 } from "./invoiceSteps.js";
import {
  InvoiceEntryRow, SPLIT_PAIR_ANSWERS, SPLIT_PAIR_QUESTION, SplitPairBadge, SplitPairFinclaSide, splitPairOutcome, untouchedSplitPair,
} from "./InvoiceSplitPair.jsx";

const QUESTION = "O que fazer com esta compra?";
/** A pergunta do passo 4 (protótipo v16): anuidade, tarifa, IOF e estorno não são "compras". */
export const CHARGE_QUESTION = "Adicionar ao Fincla?";

const ANSWERS = [
  { value: "create", label: "Adicionar", tone: T.green },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];

/**
 * O cartão aberto de uma compra nova. `onChange(id, change)` grava (o "Não registrar" minimiza
 * quando o backend aceita); `onConfirm(entry)` confirma e minimiza; clicar de novo na resposta já
 * marcada confirma também (o "Não registrar" a confirmar de uma fatura paga).
 */
function InvoiceNewPurchaseCard({ entry, form, isMobile, busy, onChange, onConfirm, question = QUESTION, cardLabel = "Compra" }) {
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
  // #574: o Repasse de IOF somado em vários lançamentos do Fincla tem a terceira resposta.
  const split = Boolean(entry.split_pair);
  const showForm = !split || entry.answer === "create";
  let confirm = entry.answer === "create" ? (
    <ConfirmAnswerButton
      disabled={busy || blank}
      blockedNote={blank ? CONFIRM_BLOCKED_NOTE : ""}
      touch={isMobile}
      onConfirm={() => desc.confirm(onConfirm)}
    />
  ) : null;
  if (untouchedSplitPair(entry)) {
    confirm = <ConfirmAnswerButton label="Confirmar sugestão" disabled={busy} touch={isMobile} onConfirm={() => onConfirm(entry)} />;
  }
  let outcome = newPurchaseOutcome(entry, form);
  if (skipped || entry.addable === false) outcome = <>Não entra no Fincla. A diferença aparece em Conferir o total.</>;
  if (split && entry.answer === "pair_split") outcome = splitPairOutcome(entry);
  else if (split && entry.answer === null) outcome = <>Escolha uma resposta.</>;
  return (
    <article
      data-testid="new-purchase-card"
      aria-label={`${cardLabel} de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.confirmed ? T.border : split && entry.answer !== "create" ? T.blue : T.green}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        {entry.answer === "pair_split" ? <SplitPairBadge entry={entry} /> : <InvoiceStatusBadge entry={entry} />}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <InvoiceBankSide entry={entry} />
        <Connector answer={entry.answer === "pair_split" ? "pair" : entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          {showForm ? <StatementEntryCard
            entry={entry}
            categories={form.categories}
            details={form.details}
            fallbackLabel={form.fallbackLabel}
            isMobile={isMobile}
            onChange={onChange}
            embedded
            desc={desc}
            skipped={skipped}
            invoice={invoiceNewPurchaseForm(entry, form.cardName, onChange, busy)}
          /> : <SplitPairFinclaSide entry={entry} />}
        </div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerSegment
          label={split ? SPLIT_PAIR_QUESTION : question}
          answers={split ? SPLIT_PAIR_ANSWERS : ANSWERS}
          value={entry.answer}
          busy={busy}
          unavailable={(a) => invoiceAnswerUnavailable(entry, a.value)}
          onAnswer={choose}
          confirm={confirm}
          note={invoiceAnswerNote(entry)}
          touch={isMobile}
        />
      </footer>
      <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
        <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>
        {outcome}
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
 * grava a confirmação antes de recolher; `answeredRef` recebe o minimizar dos atalhos (ver
 * `NewEntriesStep`). O passo 4 (#558) passa `stepKey="charges"`, a pergunta e o rótulo do cartão
 * dele, o grupo de encargos em `leading` e as teclas S/A/N do grupo em `shortcutKeys`.
 */
export function InvoiceNewStep({
  entries, queue, form, isMobile, answering, onChangeEntry, onConfirmEntry, answeredRef = null,
  stepKey = "new", question = QUESTION, cardLabel = "Compra", leading = null, shortcutKeys = null, pendingText = undefined,
}) {
  return (
    <NewEntriesStep
      stepKey={stepKey}
      leading={leading}
      shortcutKeys={shortcutKeys}
      pendingText={pendingText}
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
      answeredRef={answeredRef}
      createUnavailable={(entry) => invoiceAnswerUnavailable(entry, "create")}
      rowDetail={installmentsDetail}
      rowAmount={(entry) => <InvoiceAmount amount={entry.amount} currency={entry.currency} />}
      // #574: sem resposta, ou somado em vários do Fincla: a linha diz isso (nunca "Adicionar agora").
      renderRow={(entry, row) => (entry.answer === null || entry.answer === "pair_split" ? (
        <InvoiceEntryRow entry={entry} amount={<InvoiceAmount amount={entry.amount} currency={entry.currency} />} {...row} />
      ) : null)}
      renderCard={(entry, { busy, onChange, onConfirm }) => (
        <InvoiceNewPurchaseCard
          entry={entry}
          form={form}
          isMobile={isMobile}
          busy={busy}
          onChange={onChange}
          onConfirm={onConfirm}
          question={question}
          cardLabel={cardLabel}
        />
      )}
    />
  );
}
