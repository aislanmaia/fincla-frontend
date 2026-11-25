// Conciliar fatura, passos 2 "Compras em outra fatura" e 3 "Decidir casos com dúvida"
// (fincla-api#554/#559).
//
// O mesmo molde dos outros passos da fatura e do passo de dúvidas do extrato (`DoubtStep`, #511): só
// o lançamento atual aberto, os outros em linhas paradas (`InvoicePairRow`) com "Conferido",
// "Alterar" e "Desfazer escolha"; responder confirma e recolhe no clique; o Confirmar só na sugestão
// intacta ("Confirmar sugestão") e no formulário da compra nova. Peças comuns: as caixas "Na fatura
// do banco"/"No Fincla" e as respostas do passo 1 (`InvoiceSuggestedStep`), o formulário do item novo
// (`StatementEntryCard`) e a busca do extrato (`FinclaSearchDialog`), que aqui procura nas faturas
// vizinhas do cartão.
//
// Passo 3 (dúvida): nada vem marcado. Clicar numa opção já responde: uma opção desta fatura é "Sim,
// é esta" (`pair`); uma da fatura vizinha é "Mover" (`move`, ou `move_series` numa parcela quando o
// backend sugere a série; decisão do orquestrador), e o cartão deixa trocar entre "Mover só esta" e
// "Mover esta e as próximas" ali mesmo. As outras opções ficam esmaecidas, com "Fica de fora… vai
// para Sobrando no Fincla".
//
// Passo 2 (outra fatura): a compra que o Fincla achou na fatura vizinha, com o selo "Na fatura de
// <mês>", a "Sugestão: …" (`suggested_answer`) já marcada e "Confirmar sugestão"; à vista "Mover para
// esta fatura", parcela "Mover esta e as próximas parcelas" · "Mover só esta"; e "Adicionar como
// nova" · "Não registrar". Fatura paga (decisão 1): mover e adicionar desligados com o motivo.
import { memo } from "react";
import { ArrowRight, Info, Search, Sparkles } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import {
  CONFIRM_BLOCKED_NOTE, ConfirmAnswerButton, StatementEntryCard, bankDateLabel, useDescriptionDraft,
} from "./StatementEntryCard.jsx";
import { Hl } from "./FinclaMatchBox.jsx";
import { ANSWER_ROW, AnswerSegment, Connector, TOUCH_ANSWER_ROW, UndoChoiceButton } from "./SuggestedPairsStep.jsx";
import { CurrentEntryFrame, EntryQueueHeader, EntrySlot, answerTone, useStableCallback } from "./entryQueue.jsx";
import {
  InvoiceBankSide, InvoiceFinclaSide, InvoicePairRow, InvoiceStatusBadge, PAID_INVOICE_REASON, PURCHASE_NOUN,
  PairConsequences, bankValueDiffers, invoiceAnswerNote, invoiceAnswerUnavailable, invoiceDoubtHint, invoiceOutcomeText, moveAnswerLabel,
} from "./InvoiceSuggestedStep.jsx";
import { invoiceNewPurchaseForm } from "./InvoiceNewPurchase.jsx";
import { invoiceMonthLabel, isMoveAnswer, linksTransaction, pad2 } from "./invoiceSteps.js";

const DOUBT_QUESTION = "Esta compra do banco já está no Fincla?";

/** A pergunta do passo 2, com o mês desta fatura. */
const moveQuestion = (invoiceMonth) => `Mover esta compra para a fatura de ${invoiceMonth}?`;

/** As palavras dos textos de "Fica de fora". */
const LEFTOVER = "vai para Sobrando no Fincla";

/** O mês `n` meses depois (ou antes) de uma fatura `{year, month}`. */
export function addInvoiceMonths({ year, month }, n) {
  const index = Number(year) * 12 + (Number(month) - 1) + n;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** A fatura vem antes desta? (pelo mês em que fecha) */
const isBefore = (a, b) => a.year * 12 + a.month < b.year * 12 + b.month;

// --------------------------------------------------------------------------------------------
// As opções de uma dúvida e os resultados da busca
// --------------------------------------------------------------------------------------------

/** O outro lançamento desta conciliação que já está ligado à transação (ao vivo, das respostas de agora). */
export function takenByOf(entries, entryId, transactionId) {
  return entries.find((e) => e.id !== entryId && e.paired_transaction_id === transactionId
    && (linksTransaction(e.answer) || e.answer === "pair_sum")) ?? null;
}

/** A opção está nesta fatura? (senão, escolhê-la é "Mover") */
export const inThisInvoice = (candidate, invoice) => (candidate.invoice ? candidate.invoice.id === invoice.id : candidate.invoice_id === invoice.id);

/**
 * A resposta que escolher a opção dá: nesta fatura, "Sim, é esta" (`pair`); na vizinha, "Mover"
 * (decisão do orquestrador): numa parcela, a sugestão do backend quando ele a dá (`suggested_answer`,
 * série deslocada → "esta e as próximas"), senão "só esta", que muda o mínimo.
 */
export function pickAnswerOf(entry, candidate, invoice) {
  if (inThisInvoice(candidate, invoice)) return "pair";
  if (candidate.installment && entry.suggested_answer === "move_series") return "move_series";
  return "move";
}

/**
 * Por que a opção não pode ser escolhida (decisão 1): mover de/para uma fatura paga. `null` = pode.
 * Ligar ("Sim, é esta") vale mesmo em fatura paga: só não troca o valor.
 */
export function pickRefusal(entry, candidate, invoice) {
  if (inThisInvoice(candidate, invoice)) return null;
  if (entry.value_locked || invoice.status === "paid") return PAID_INVOICE_REASON;
  if (candidate.invoice?.status === "paid") {
    return `A fatura de ${invoiceMonthLabel(candidate.invoice)} já foi paga. Para mover esta compra, desmarque o pagamento dela e volte aqui.`;
  }
  return null;
}

const NOTE = { ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", lineHeight: 1.5 };
const TAG = { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" };

/** A nota de uma opção que ficou de fora (a pessoa escolheu outra): "Fica de fora… vai para Sobrando". */
function LeftOutNote({ candidate, invoice }) {
  const here = inThisInvoice(candidate, invoice);
  return (
    <div data-testid="left-out-note" style={NOTE}>
      <span style={{ ...TAG, color: T.inkMid, background: T.surface, border: `1px solid ${T.inkFaint}` }}>Fica de fora</span>
      <span style={{ flex: "1 1 180px", minWidth: 0 }}>
        {here
          ? <>Continua no Fincla como está, sem mudança. Como o banco não cobrou outra compra igual nesta fatura, ela {LEFTOVER}, onde você decide se mantém, move ou exclui.</>
          : <>Continua na fatura de {invoiceMonthLabel(candidate.invoice)}, sem mudança.</>}
      </span>
    </div>
  );
}

/** "Valor parecido": a diferença em destaque e o que acontece se for esta. */
function CandidateDifference({ entry, candidate }) {
  if (!candidate.differences.includes("amount")) return null;
  const bank = Math.abs(entry.amount);
  const gap = Math.abs(candidate.value - bank);
  return (
    <div data-testid="candidate-difference" style={NOTE}>
      <span style={{ ...TAG, color: T.amber, background: T.amberLight }}>Valor diferente</span>
      <span style={{ flex: "1 1 180px", minWidth: 0 }}>
        Diferença de <Hl on><b style={NUM}>{formatMoney(gap, entry.currency ?? candidate.currency)}</b></Hl>: o banco cobrou{" "}
        <b style={NUM}>{formatMoney(bank, entry.currency)}</b>.{" "}
        {entry.value_locked
          ? <>Fatura já paga: o valor não muda.</>
          : <>Se for esta, ao concluir vale o valor do banco.</>}
      </span>
    </div>
  );
}

/**
 * Uma opção do Fincla (da dúvida ou da busca): a caixa "No Fincla" inteira é clicável (o botão a
 * cobre por cima, sem embrulhar a lista de dados). `pressed` = a escolhida; `faded` = ficou de fora
 * (a pessoa escolheu outra); `takenBy` = já é a resposta de outro lançamento; `refusal` = não dá
 * para mover (fatura paga, decisão 1). Os dois últimos ficam à vista, sem clique, com o motivo.
 */
export const InvoiceCandidateOption = memo(function InvoiceCandidateOptionView({
  entry, candidate, invoice, invoiceMonth, pressed = false, faded = false, takenBy = null, refusal = null, busy = false, onPick,
}) {
  const here = inThisInvoice(candidate, invoice);
  const off = Boolean(takenBy || refusal);
  const day = candidate.installment ? candidate.purchase_date : (candidate.purchase_date ?? String(candidate.date).slice(0, 10));
  let note = null;
  if (takenBy) {
    note = (
      <p data-testid="candidate-taken" style={{ ...G, fontSize: 12, color: T.inkMid, margin: "8px 0 0" }}>
        Já é a resposta do lançamento de <b style={NUM}>{bankDateLabel(takenBy.date)}</b> ({takenBy.bank_description}). Para escolhê-la aqui, mude a resposta de lá primeiro.
      </p>
    );
  } else if (refusal) {
    note = <p data-testid="candidate-refusal" style={{ ...G, fontSize: 12, color: T.inkMid, margin: "8px 0 0" }}>{refusal}</p>;
  } else if (faded) {
    note = <LeftOutNote candidate={candidate} invoice={invoice} />;
  } else if (!pressed) {
    note = <CandidateDifference entry={entry} candidate={candidate} />;
  }
  let action = "Sim, é esta";
  if (!here) action = moveAnswerLabel({ installment: candidate.installment }, pickAnswerOf(entry, candidate, invoice));
  return (
    <div
      data-testid="candidate-option"
      data-pressed={pressed ? "true" : "false"}
      data-faded={faded ? "true" : "false"}
      aria-disabled={off || undefined}
      style={{ position: "relative", display: "flex", minWidth: 0, borderRadius: 12, opacity: faded || off ? 0.7 : 1, background: pressed ? T.blueLight : undefined }}
    >
      <InvoiceFinclaSide
        entry={entry}
        match={candidate}
        invoiceMonth={invoiceMonth}
        elsewhere={here ? null : candidate.invoice}
        linked={pressed}
        consequences={note}
      />
      {off ? null : (
        <button
          type="button"
          aria-pressed={pressed}
          disabled={busy}
          aria-label={`${action}: ${candidate.description}, ${bankDateLabel(day)}, ${formatMoney(candidate.value, candidate.currency)}${here ? "" : `, na fatura de ${invoiceMonthLabel(candidate.invoice)}`}`}
          onClick={() => onPick(candidate)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, padding: 0, border: 0, borderRadius: "inherit", background: "transparent", cursor: busy ? "not-allowed" : "pointer" }}
        />
      )}
    </div>
  );
});

/** Os textos da busca "Procure no Fincla" da fatura (a mesma busca do extrato, #511). */
export const INVOICE_SEARCH_COPY = {
  title: "Procure no Fincla",
  bankLabel: "Na fatura do banco",
  inputLabel: "Buscar por descrição, valor ou dia",
  placeholder: "Ex.: posto, 150,40 ou 12/11",
  hint: "Mostra os itens deste cartão na fatura conciliada, na anterior e na seguinte, do mesmo sentido do lançamento e ainda não ligados ao banco, do valor mais parecido para o menos.",
};

/** O valor do banco na busca, como a fatura mostra (cobrança sem sinal, crédito com "−"). */
export const invoiceSearchAmount = (entry) => (entry.amount > 0 ? `−${formatMoney(entry.amount, entry.currency)}` : formatMoney(Math.abs(entry.amount), entry.currency));

// --------------------------------------------------------------------------------------------
// O lado "No Fincla" de cada passo
// --------------------------------------------------------------------------------------------

/** As opções da dúvida, com a escolhida (também a que veio da busca) e as que ficaram de fora. */
function DoubtOptions({ entry, entries, invoice, invoiceMonth, busy, onPick, onSearch }) {
  const options = entry.candidates ?? [];
  const linked = linksTransaction(entry.answer) ? entry.fincla_transaction : null;
  const chosenId = linked?.id ?? null;
  // A escolhida pela busca, que não é uma das opções: aparece primeiro, marcada.
  const outside = linked && !options.some((o) => o.id === chosenId)
    ? [{ ...linked, invoice: entry.other_invoice ?? { id: invoice.id, year: invoice.year, month: invoice.month, status: invoice.status }, taken_by_entry_id: null }]
    : [];
  const shown = [...outside, ...options];
  if (!shown.length) {
    return (
      <section style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1, background: T.grayLight }}>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "0 0 8px" }}>
          Nada parecido nesta fatura no Fincla. Talvez ela esteja com outros dados, ou na fatura anterior ou na seguinte: procure no Fincla.
        </p>
        <Btn variant="outGray" small onClick={() => onSearch(entry)} disabled={busy}>Está no Fincla com outros dados…</Btn>
      </section>
    );
  }
  const free = options.filter((o) => !takenByOf(entries, entry.id, o.id) && !pickRefusal(entry, o, invoice));
  let prompt;
  if (chosenId !== null) {
    prompt = shown.length > 1 ? "Você escolheu a compra em azul. Clique em outra para trocar." : null;
  } else if (free.length > 1) prompt = "Qual destas é a mesma compra? Clique para escolher.";
  else if (free.length === 1 && free[0].differences.includes("amount")) prompt = "Valor parecido: confira e clique nela se for a mesma.";
  else if (free.length === 1) prompt = "Confira e clique nela se for a mesma.";
  else prompt = "Nenhuma destas pode ser escolhida agora. Procure no Fincla ou responda de outro jeito.";
  return (
    <div data-testid="doubt-options" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      {prompt ? (
        <p data-testid="doubt-prompt" style={{ ...G, fontSize: 12, fontWeight: 600, color: chosenId === null ? T.amber : T.inkLight, margin: 0 }}>{prompt}</p>
      ) : null}
      {shown.map((candidate) => {
        const pressed = candidate.id === chosenId;
        return (
          <InvoiceCandidateOption
            key={candidate.id}
            entry={entry}
            candidate={candidate}
            invoice={invoice}
            invoiceMonth={invoiceMonth}
            pressed={pressed}
            faded={chosenId !== null && !pressed}
            takenBy={pressed ? null : takenByOf(entries, entry.id, candidate.id)}
            refusal={pressed ? null : pickRefusal(entry, candidate, invoice)}
            busy={busy}
            onPick={(picked) => onPick(entry, picked)}
          />
        );
      })}
      {chosenId !== null ? <ChosenConsequences entry={entry} /> : null}
    </div>
  );
}

/** "Não registrar" numa dúvida: as opções continuam à vista, listradas e sem clique, com "Fica de fora". */
function DoubtSkipped({ entry, invoice, invoiceMonth }) {
  const options = entry.candidates ?? [];
  if (!options.length) return <InvoiceFinclaSide entry={entry} match={null} invoiceMonth={invoiceMonth} skipped />;
  const here = options.filter((o) => inThisInvoice(o, invoice)).length;
  const text = here
    ? `Continua no Fincla como está. Como o banco não cobrou outra compra igual nesta fatura, ${here === 1 ? "ela" : "elas"} ${here === 1 ? LEFTOVER : "vão para Sobrando no Fincla"}. Este lançamento do banco não entra no Fincla.`
    : "Continua no Fincla como está, na fatura onde está. Este lançamento do banco não entra no Fincla.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      {options.map((candidate, index) => (
        <InvoiceFinclaSide
          key={candidate.id}
          entry={entry}
          match={candidate}
          invoiceMonth={invoiceMonth}
          elsewhere={inThisInvoice(candidate, invoice) ? null : candidate.invoice}
          skipped
          skipText={index === options.length - 1 ? text : ""}
        />
      ))}
    </div>
  );
}

/** O que muda ao mover (#559): à vista, só esta (parcela) ou a série desta parcela em diante. */
export function MoveConsequences({ entry, invoice }) {
  const from = entry.other_invoice;
  const match = entry.fincla_transaction;
  if (!from || !match) return null;
  const here = invoiceMonthLabel(invoice);
  const there = invoiceMonthLabel(from);
  const installment = match.installment ?? entry.installment;
  let text;
  if (entry.answer === "move_series" && installment) {
    const left = installment.count - installment.number;
    const last = invoiceMonthLabel(addInvoiceMonths(invoice, left));
    const direction = isBefore(from, invoice) ? "avançam" : "voltam";
    text = (
      <>
        Ao concluir, as parcelas <b style={NUM}>{pad2(installment.number)} a {pad2(installment.count)}/{pad2(installment.count)}</b> {direction} uma fatura:
        a {pad2(installment.number)} entra em <b>{here}</b>{left ? <> e a última termina em <b>{last}</b>, como no banco</> : null}. As anteriores não mudam.
      </>
    );
  } else if (installment) {
    const left = installment.count - 1;
    text = (
      <>
        Só a parcela <b style={NUM}>{pad2(installment.number)}/{pad2(installment.count)}</b> sai da fatura de {there} e entra em <b>{here}</b>, com o vencimento desta fatura.
        {left ? <> As outras {plural(left, "parcela continua", "parcelas continuam")} onde {left === 1 ? "está" : "estão"}.</> : null}
      </>
    );
  } else {
    text = (
      <>
        Ao concluir, a compra sai da fatura de {there} e entra na de <b>{here}</b>, com a data da compra. A fatura de {there} no Fincla fica{" "}
        <b style={NUM}>{formatMoney(match.value, match.currency)}</b> menor.
      </>
    );
  }
  return (
    <div data-testid="move-consequences" style={NOTE}>
      <ArrowRight size={13} aria-hidden="true" style={{ alignSelf: "center", color: T.blue }} />
      <span style={{ flex: "1 1 180px", minWidth: 0 }}>{text}</span>
    </div>
  );
}

/** A escolhida numa dúvida: o que acontece com ela (ligar, ou mover) e o valor do banco. */
function ChosenConsequences({ entry }) {
  if (isMoveAnswer(entry.answer)) return bankValueDiffers(entry) ? <PairConsequences entry={entry} /> : null;
  return <PairConsequences entry={entry} />;
}

/** As duas notas do passo 2: a "Sugestão: …" (fixa, do backend) e "Outra fatura". */
function OtherInvoiceNotes({ entry, invoice }) {
  const from = entry.other_invoice;
  const installment = entry.installment ?? entry.fincla_transaction?.installment;
  let why = null;
  if (entry.suggested_answer === "move_series") {
    why = "No Fincla, a parcela anterior desta compra está nesta fatura: a série inteira está uma fatura à frente do banco.";
  } else if (entry.suggested_answer === "move" && installment) {
    why = `No Fincla, as parcelas vizinhas estão no lugar certo: só esta parcela saiu${from ? ` para a fatura de ${invoiceMonthLabel(from)}` : ""}.`;
  } else if (entry.suggested_answer === "move") {
    why = "Compra à vista: só esta compra muda de fatura.";
  }
  return (
    <>
      {entry.suggested_answer ? (
        <div data-testid="move-suggestion" style={NOTE}>
          <span style={{ ...TAG, color: T.blue, background: T.blueLight, display: "inline-flex", gap: 4, alignItems: "center" }}>
            <Sparkles size={11} aria-hidden="true" />Sugestão
          </span>
          <span style={{ flex: "1 1 180px", minWidth: 0 }}><b>{moveAnswerLabel(entry, entry.suggested_answer)}</b>. {why}</span>
        </div>
      ) : null}
      {from ? (
        <div data-testid="other-invoice-note" style={NOTE}>
          <span style={{ ...TAG, color: T.amber, background: T.amberLight }}>Outra fatura</span>
          <span style={{ flex: "1 1 180px", minWidth: 0 }}>
            No Fincla esta compra está na fatura de <b>{invoiceMonthLabel(from)}</b>. O banco cobrou na de <b>{invoiceMonthLabel(invoice)}</b>.
          </span>
        </div>
      ) : null}
      {isMoveAnswer(entry.answer) ? <MoveConsequences entry={entry} invoice={invoice} /> : null}
      {isMoveAnswer(entry.answer) && bankValueDiffers(entry) ? <PairConsequences entry={entry} /> : null}
    </>
  );
}

// --------------------------------------------------------------------------------------------
// As respostas
// --------------------------------------------------------------------------------------------

/** Os motivos escritos ao lado das respostas, sem repetir. */
function answerNotes(...notes) {
  const unique = [...new Set(notes.filter(Boolean))];
  return unique.length ? unique.join(" ") : null;
}

/** As respostas do passo 2: as de mover (pela parcela), Adicionar como nova e Não registrar. */
export function otherInvoiceAnswers(entry) {
  const create = { value: "create", label: "Adicionar como nova", tone: T.green };
  const ignore = { value: "ignore", label: "Não registrar", tone: T.inkLight };
  if (entry.installment) {
    return [
      { value: "move_series", label: "Mover esta e as próximas parcelas", tone: T.blue },
      { value: "move", label: "Mover só esta", tone: T.blue },
      create,
      ignore,
    ];
  }
  return [{ value: "move", label: "Mover para esta fatura", tone: T.blue }, create, ignore];
}

/** A resposta do passo 2 está desligada? (mover pelo backend, `movable`/`series_movable`; adicionar pela decisão 1) */
export function otherInvoiceAnswerUnavailable(entry, value) {
  if (value === "move") return !entry.movable || !entry.fincla_transaction;
  if (value === "move_series") return !entry.series_movable || !entry.fincla_transaction;
  return invoiceAnswerUnavailable(entry, value);
}

/** Por que as respostas desligadas do passo 2 estão desligadas. */
function otherInvoiceNote(entry) {
  const moveOff = otherInvoiceAnswerUnavailable(entry, "move") || (entry.installment && otherInvoiceAnswerUnavailable(entry, "move_series"));
  return answerNotes(moveOff ? entry.move_refusal?.message : null, invoiceAnswerNote(entry));
}

/** A sugestão do passo 2 sem nenhuma mudança: só aí o "Confirmar sugestão". */
export const untouchedMoveSuggestion = (entry) => Boolean(entry.suggested_answer) && entry.answer === entry.suggested_answer
  && !entry.confirmed && Boolean(entry.fincla_transaction);

/**
 * Na dúvida respondida com uma compra da fatura vizinha que é parcela: trocar ali mesmo entre "Mover
 * só esta" e "Mover esta e as próximas parcelas" (decisão do orquestrador), como no passo 2.
 */
function MoveChoice({ entry, busy, touch, onChoose }) {
  const installment = entry.fincla_transaction?.installment;
  if (!isMoveAnswer(entry.answer) || !installment) return null;
  const options = [
    { value: "move", label: "Mover só esta", off: !entry.movable },
    { value: "move_series", label: "Mover esta e as próximas parcelas", off: !entry.series_movable },
  ];
  const refusal = options.some((o) => o.off && o.value !== entry.answer) ? entry.move_refusal?.message : null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexBasis: "100%" }}>
      <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>Como mover a parcela:</span>
      <div role="group" aria-label="Como mover a parcela" style={touch ? TOUCH_ANSWER_ROW : ANSWER_ROW}>
        {options.map((o, index) => {
          const pressed = entry.answer === o.value;
          const off = o.off && !pressed;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={pressed}
              disabled={busy || off}
              onClick={() => onChoose(o.value)}
              style={{
                ...G, minHeight: touch ? TOUCH_TARGET : 32, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: busy || off ? "not-allowed" : "pointer", border: 0,
                ...(touch
                  ? { flex: "1 1 auto", background: pressed ? T.blue : T.bg }
                  : { borderRight: index < options.length - 1 ? `1px solid ${T.border}` : 0, background: pressed ? T.blue : "transparent" }),
                color: pressed ? "#fff" : T.inkLight,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {refusal ? <span data-testid="move-choice-note" style={{ ...G, fontSize: 12, color: T.inkMid, flexBasis: "100%" }}>{refusal}</span> : null}
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// O cartão
// --------------------------------------------------------------------------------------------

/**
 * O cartão aberto dos passos 2 e 3. `handlers`: `onAnswer(entry, value)` (responder, como no passo 1),
 * `onPick(entry, candidate)` (escolher uma opção), `onMove(entry, value)` (trocar o jeito de mover),
 * `onYes(entry)` ("Sim, é esta" sem escolher), `onSearch(entry)`, `onChange`, `onConfirmNew`,
 * `onUndoChoice`.
 */
function InvoiceChoiceCard({ entry, entries, invoice, invoiceMonth, isMobile, busy, canUndo, wantPair, form, handlers }) {
  const { onAnswer, onPick, onMove, onYes, onSearch, onChange, onConfirmNew, onUndoChoice } = handlers;
  const doubt = entry.classification === "doubt";
  const desc = useDescriptionDraft(entry, onChange);
  const linked = linksTransaction(entry.answer);
  let right;
  if (entry.answer === "create") {
    right = (
      <StatementEntryCard
        entry={entry}
        categories={form.categories}
        details={form.details}
        fallbackLabel={form.fallbackLabel}
        isMobile={isMobile}
        onChange={onChange}
        embedded
        desc={desc}
        invoice={invoiceNewPurchaseForm(entry, form.cardName, onChange, busy)}
      />
    );
  } else if (doubt && entry.answer === "ignore") {
    right = <DoubtSkipped entry={entry} invoice={invoice} invoiceMonth={invoiceMonth} />;
  } else if (doubt) {
    right = <DoubtOptions entry={entry} entries={entries} invoice={invoice} invoiceMonth={invoiceMonth} busy={busy} onPick={onPick} onSearch={onSearch} />;
  } else {
    const skipped = entry.answer === "ignore";
    right = (
      <InvoiceFinclaSide
        entry={entry}
        invoiceMonth={invoiceMonth}
        elsewhere={entry.other_invoice}
        skipped={skipped}
        linked={linked}
        skipText={entry.other_invoice
          ? `Continua na fatura de ${invoiceMonthLabel(entry.other_invoice)}, sem mudança. Este lançamento do banco não entra no Fincla, e a diferença aparece em Conferir o total.`
          : null}
        consequences={<OtherInvoiceNotes entry={entry} invoice={invoice} />}
        onConfirm={untouchedMoveSuggestion(entry) && !busy ? () => onAnswer(entry, entry.answer) : null}
      />
    );
  }

  let confirm = null;
  if (!doubt && untouchedMoveSuggestion(entry)) {
    confirm = <ConfirmAnswerButton label="Confirmar sugestão" disabled={busy} touch={isMobile} onConfirm={() => onAnswer(entry, entry.answer)} />;
  } else if (entry.answer === "create") {
    const blank = !desc.value.trim();
    confirm = <ConfirmAnswerButton disabled={busy || blank} blockedNote={blank ? CONFIRM_BLOCKED_NOTE : ""} touch={isMobile} onConfirm={() => desc.confirm(onConfirmNew)} />;
  }
  // "Não, adicionar agora" / "Adicionar como nova" já marcado: clicar de novo confirma, como o Confirmar.
  const answerClick = (value) => {
    if (value === "create" && entry.answer === "create") {
      if (!busy && desc.value.trim()) desc.confirm(onConfirmNew);
      return;
    }
    if (doubt && value === "pair") {
      onYes(entry);
      return;
    }
    onAnswer(entry, value);
  };

  const answers = doubt
    ? [
      { value: "pair", label: "Sim, é esta", tone: T.blue },
      { value: "create", label: "Não, adicionar agora", tone: T.green },
      { value: "ignore", label: "Não registrar", tone: T.inkLight },
    ]
    : otherInvoiceAnswers(entry);
  const shownValue = doubt && (linked || (entry.answer === null && wantPair)) ? "pair" : entry.answer;
  const outcome = invoiceOutcomeText(entry, { ...form, invoiceMonth });
  const connector = linked ? "pair" : entry.answer;
  return (
    <article
      data-testid={doubt ? "doubt-card" : "move-card"}
      aria-label={`Lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.answer === null ? T.amber : !entry.confirmed ? T.blue : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <InvoiceStatusBadge entry={entry} />
        {entry.answer === null ? <span style={{ ...G, fontSize: 12, color: T.inkLight }}>{invoiceDoubtHint(entry)}</span> : null}
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} touch={isMobile} /> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <InvoiceBankSide entry={entry} valueDiffers={linked && Boolean(entry.fincla_transaction?.differences.includes("amount"))} />
        <Connector answer={connector} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{right}</div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
        <AnswerSegment
          label={doubt ? DOUBT_QUESTION : moveQuestion(invoiceMonth)}
          answers={answers}
          value={shownValue}
          busy={busy}
          unavailable={(a) => {
            // "Sim, é esta" na dúvida nunca desliga: sem opção livre, ele abre a busca.
            if (doubt) return a.value === "pair" ? false : invoiceAnswerUnavailable(entry, a.value);
            return otherInvoiceAnswerUnavailable(entry, a.value);
          }}
          onAnswer={answerClick}
          confirm={confirm}
          note={doubt ? invoiceAnswerNote(entry) : otherInvoiceNote(entry)}
          touch={isMobile}
        />
        {doubt ? <MoveChoice entry={entry} busy={busy} touch={isMobile} onChoose={(value) => onMove(entry, value)} /> : null}
        {doubt ? (
          <div>
            <Btn variant="outGray" small onClick={() => onSearch(entry)} disabled={busy} style={isMobile ? { minHeight: TOUCH_TARGET } : undefined}>
              <Search size={13} aria-hidden="true" />Está no Fincla com outros dados…
            </Btn>
          </div>
        ) : null}
      </footer>
      {outcome ? (
        <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>{outcome}
        </p>
      ) : entry.answer === null && wantPair ? (
        <p style={{ ...G, fontSize: 12, color: T.amber, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>Escolha ao lado qual compra é.
        </p>
      ) : null}
    </article>
  );
}

/**
 * A lista de um dos dois passos: só o atual aberto (`queue.currentId`); os outros, respondidos ou
 * não, ficam em linhas paradas. `history` diz se há o que desfazer; `wantPair`, as dúvidas em que a
 * pessoa disse "Sim, é esta" sem escolher qual ainda.
 */
export function InvoiceChoiceStep({
  stepKey, entries, allEntries, invoice, queue, isMobile, busy, history, wantPair, form, handlers, pendingText = undefined,
}) {
  const invoiceMonth = invoiceMonthLabel(invoice);
  const openRow = useStableCallback((entry) => queue.open(entry.id));
  const undoChoice = useStableCallback(handlers.onUndoChoice);
  const canUndo = (entry) => Boolean(history[entry.id]?.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <EntryQueueHeader queue={queue} shortcutKeys={["s", "a", "n"]} noun={PURCHASE_NOUN} touch={isMobile} pendingText={pendingText} />
      {stepKey === "other_invoice" ? (
        <p role="note" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, display: "flex", gap: 6, alignItems: "baseline" }}>
          <Info size={13} aria-hidden="true" style={{ flexShrink: 0, alignSelf: "center" }} />
          <span>O Fincla achou cada compra numa fatura vizinha deste cartão. Nada muda de fatura até você concluir.</span>
        </p>
      ) : null}
      {entries.filter(queue.shown).map((entry) => (
        <EntrySlot key={entry.id} entryId={entry.id} open={entry.id === queue.currentId} tone={answerTone(linksTransaction(entry.answer) ? "pair" : entry.answer)}>
          {entry.id === queue.currentId ? (
            <CurrentEntryFrame queue={queue} entry={entry} noun={PURCHASE_NOUN}>
              <InvoiceChoiceCard
                entry={entry}
                entries={allEntries}
                invoice={invoice}
                invoiceMonth={invoiceMonth}
                isMobile={isMobile}
                busy={busy}
                canUndo={canUndo(entry)}
                wantPair={wantPair.has(entry.id)}
                form={form}
                handlers={handlers}
              />
            </CurrentEntryFrame>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <InvoicePairRow entry={entry} canUndo={canUndo(entry)} focus={queue.rowFocusId === entry.id} touch={isMobile} onOpen={openRow} onUndoChoice={undoChoice} />
            </div>
          )}
        </EntrySlot>
      ))}
    </div>
  );
}

/** Um resultado da busca da fatura (#559): a mesma caixa das opções, com o motivo quando não vale. */
export function InvoiceSearchResult({ entry, entries, invoice, candidate, busy, onPick }) {
  const takenBy = takenByOf(entries, entry.id, candidate.id);
  return (
    <InvoiceCandidateOption
      entry={entry}
      candidate={candidate}
      invoice={invoice}
      invoiceMonth={invoiceMonthLabel(invoice)}
      pressed={linksTransaction(entry.answer) && entry.paired_transaction_id === candidate.id}
      takenBy={takenBy}
      refusal={takenBy ? null : pickRefusal(entry, candidate, invoice)}
      busy={busy}
      onPick={onPick}
    />
  );
}
