// Conciliar fatura, passo 1 "Confirmar compras encontradas" (fincla-api#554/#555).
//
// O mesmo molde do passo do extrato (`SuggestedPairsStep`): só o lançamento atual aberto, os outros
// em linhas; responder confirma e recolhe no clique; o Confirmar só na sugestão intacta; a linha
// respondida fica parada com "Conferido", "Alterar" e "Desfazer escolha". Muda o que é da fatura: o
// lado "Na fatura do banco" com a seção e o final do cartão, a parcela casada pela data da compra da
// série, o "Valor diferente" (vale o do banco, decisão 2) e a fatura já paga (só ligar, decisão 1).
// Os lançamentos dos outros passos aparecem só para leitura: "Fica de fora nesta versão".
import { memo, useEffect, useRef } from "react";
import { ArrowRight, Ban, Check, ChevronRight, Info, Link2, Sparkles } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { BOX, BOX_LABEL, ConfirmAnswerButton, SKIP_BG, SkipBadge, SkipNote, bankDateLabel } from "./StatementEntryCard.jsx";
import { DifferenceTag, Hl, SuggestedBadge, dayOf } from "./FinclaMatchBox.jsx";
import { AnswerSegment, Connector, UndoChoiceButton } from "./SuggestedPairsStep.jsx";
import {
  ConferidoBadge, CurrentEntryFrame, EntryQueueHeader, EntrySlot, ROW_CLICKABLE, answerTone, isAnswered, openOnRowClick, useStableCallback,
} from "./entryQueue.jsx";
import { unconfirmedInvoiceSuggestions } from "./invoiceSteps.js";

/** As palavras da lista do passo: compras da fatura. */
export const PURCHASE_NOUN = {
  title: "Compra",
  one: "compra",
  many: "compras",
  answeredOne: "compra já respondida não aparece",
  answeredMany: "compras já respondidas não aparecem",
  pendingOne: "compra sem resposta não aparece",
  pendingMany: "compras sem resposta não aparecem",
};

export const SECTION_LABEL = {
  purchases: "Compras",
  international: "Internacional",
  services: "Produtos e serviços",
  charges: "Encargos",
};

/** Nesta versão a fatura só liga ou deixa de fora; "adicionar" e "mover" chegam nas próximas. */
const ANSWERS = [
  { value: "pair", label: "Sim, é esta", tone: T.blue },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];

const QUESTION = "Esta compra do banco já está no Fincla?";

/** Decisão 1 do Owner: o que a fatura paga não deixa fazer, e como corrigir. */
export const PAID_INVOICE_REASON = "Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.";

/** O valor do banco é outro que o do Fincla (pelo `differences` do backend ou pela conta). */
export function bankValueDiffers(entry) {
  const match = entry.fincla_transaction;
  if (!match) return false;
  return match.differences.includes("amount") || Math.abs(match.value - Math.abs(entry.amount)) >= 0.005;
}

/**
 * Fatura já paga com valor diferente: o valor do Fincla não pode virar o do banco (decisão 1), e a
 * tela diz o motivo. Com valor igual não há nada a dizer.
 */
export const paidValueLocked = (entry) => entry.value_locked && bankValueDiffers(entry);

/**
 * A resposta não está disponível? Uma regra só para o botão e para o atalho (S/N). "Sim, é esta"
 * precisa da transação do Fincla. "Não registrar" não muda nada no Fincla, então fica disponível
 * mesmo numa fatura paga: a fatura paga só trava o que mexeria nela (adicionar, mover, excluir,
 * trocar o valor), respostas que esta versão ainda não tem.
 */
export const invoiceAnswerUnavailable = (entry, value) => (value === "pair" ? !entry.fincla_transaction : false);

/** O valor como a fatura mostra: cobrança sem sinal; crédito (estorno, redução) com "−", em verde. */
export function InvoiceAmount({ amount, currency, strong = false }) {
  const credit = amount > 0;
  const text = formatMoney(Math.abs(amount), currency);
  return <span style={{ ...NUM, color: credit ? T.green : T.ink, fontWeight: strong ? 700 : undefined }}>{credit ? `−${text}` : text}</span>;
}

/** O valor de uma transação do Fincla no mesmo sentido: estorno e receita diminuem a fatura. */
function FinclaAmount({ match }) {
  return <InvoiceAmount amount={match.type === "expense" ? -match.value : match.value} currency={match.currency} />;
}

function InstallmentBadge({ installment }) {
  if (!installment) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <span data-testid="installment-badge" style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.inkMid, background: T.grayLight, borderRadius: 6, padding: "1px 6px", marginLeft: 6, whiteSpace: "nowrap" }}>
      {pad(installment.number)}/{pad(installment.count)}
    </span>
  );
}

const DT = { ...G, fontSize: 11, color: T.inkLight };
const DD = { ...G, fontSize: 13, color: T.ink, margin: 0, minWidth: 0, wordBreak: "break-word" };

function Fields({ rows }) {
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", alignItems: "baseline" }}>
      {rows.filter(Boolean).map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt style={DT}>{label}</dt>
          <dd style={DD}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** O selo do lado do banco: o que acontece com o lançamento (espelha o lado do Fincla). */
function BankStatus({ answer }) {
  if (answer === "ignore") {
    return <Badge color={T.surface} bg={T.inkMid}><Ban size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Não entra no Fincla</Badge>;
  }
  if (answer === "pair") {
    return <Badge color={T.blue} bg={T.blueLight}><Link2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Ligado ao Fincla</Badge>;
  }
  return null;
}

/** "Na fatura do banco": data, descrição (com o "NN/MM"), valor, seção e o final do cartão. */
export function InvoiceBankSide({ entry, valueDiffers = false }) {
  return (
    <section data-testid="bank-side" style={{ ...BOX, background: entry.answer === "ignore" ? SKIP_BG : T.bg }}>
      <div style={BOX_LABEL}>Na fatura do banco <BankStatus answer={entry.answer} /></div>
      <Fields
        rows={[
          ["Data", <span key="d" style={NUM}>{bankDateLabel(entry.date)}</span>],
          ["Descrição", <b key="n">{entry.bank_description}</b>],
          ["Valor", <Hl key="v" on={valueDiffers}><InvoiceAmount amount={entry.amount} currency={entry.currency} strong /></Hl>],
          ["Seção", SECTION_LABEL[entry.section] ?? entry.section],
          entry.card_last4 ? ["Cartão", <span key="c" style={NUM}>final {entry.card_last4}</span>] : null,
          entry.foreign_amount ? ["Moeda", <span key="f" style={NUM}>{entry.foreign_amount.currency} {entry.foreign_amount.amount}</span>] : null,
        ]}
      />
    </section>
  );
}

const CONS = { ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", lineHeight: 1.5 };
const CTAG = { fontSize: 11, fontWeight: 700, color: T.amber, background: T.amberLight, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" };

/**
 * O que acontece com o par ao concluir. Valor igual: só liga. Valor diferente: vale o do banco
 * (`value_change`, decisão 2), e numa parcela com parcelas seguintes o aviso de quanto o total da
 * compra fica diferente do banco até as outras serem conciliadas. Fatura já paga (`value_locked`,
 * decisão 1): liga sem trocar o valor.
 */
export function PairConsequences({ entry }) {
  const match = entry.fincla_transaction;
  if (!match) return null;
  const bank = Math.abs(entry.amount);
  if (!bankValueDiffers(entry)) {
    return (
      <div data-testid="pair-consequences" style={CONS}>
        <Check size={13} aria-hidden="true" style={{ color: T.green, alignSelf: "center" }} />
        <span>Ao concluir, a compra fica <b>ligada ao lançamento do banco</b>. Nada mais muda nela.</span>
      </div>
    );
  }
  const currency = entry.currency ?? match.currency;
  const gap = Math.abs(match.value - bank);
  const said = (
    <span>
      O banco cobrou <b style={NUM}>{formatMoney(bank, currency)}</b>; no Fincla está <b style={NUM}>{formatMoney(match.value, match.currency)}</b> (diferença de <b style={NUM}>{formatMoney(gap, currency)}</b>).
    </span>
  );
  if (entry.value_locked) {
    return (
      <div data-testid="pair-consequences" style={CONS}>
        <span style={CTAG}>Valor diferente</span>
        {said}
        <span style={{ flexBasis: "100%" }}><b>Fatura já paga: o valor não muda.</b> A compra só fica ligada ao lançamento do banco.</span>
      </div>
    );
  }
  const change = entry.value_change;
  const installment = entry.installment;
  const left = installment ? installment.count - installment.number : 0;
  let future = null;
  if (left > 0) {
    // Sem o ajuste das próximas parcelas nesta versão: elas continuam com o valor do Fincla.
    const complete = entry.next_installments.length === left;
    const bankFuture = complete ? entry.next_installments.reduce((sum, n) => sum + n.amount, 0) : left * bank;
    const drift = Math.abs(left * match.value - bankFuture);
    if (drift >= 0.005) {
      future = (
        <p data-testid="future-installments-note" style={{ ...G, fontSize: 12, color: T.inkMid, margin: "8px 0 0", display: "flex", gap: 6, alignItems: "baseline" }}>
          <Info size={13} aria-hidden="true" style={{ flexShrink: 0, alignSelf: "center" }} />
          <span>
            As outras {plural(left, "parcela", "parcelas")} desta compra continuam com o valor do Fincla. Até {left === 1 ? "ela ser conciliada" : "elas serem conciliadas"}, o total da compra fica <b style={NUM}>{formatMoney(drift, currency)}</b> diferente do banco.
          </span>
        </p>
      );
    }
  }
  return (
    <div data-testid="pair-consequences">
      <div style={CONS}>
        <span style={CTAG}>Valor diferente</span>
        {said}
        {change ? (
          <span data-testid="value-change" style={{ flexBasis: "100%", display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            Ao concluir, vale o valor do banco:
            <s style={{ ...NUM, color: T.inkLight }}>{formatMoney(change.from, change.currency)}</s>
            <ArrowRight size={13} aria-hidden="true" />
            <b style={NUM}>{formatMoney(change.to, change.currency)}</b>
          </span>
        ) : null}
      </div>
      {future}
    </div>
  );
}

/** "No Fincla": a transação ligada, como está hoje. `skipped` = "Não registrar" (cinza listrado). */
export function InvoiceFinclaSide({ entry, invoiceMonth, skipped = false, onConfirm = null }) {
  const match = entry.fincla_transaction;
  if (!match) {
    return (
      <section style={{ ...BOX, background: skipped ? SKIP_BG : T.grayLight }}>
        <div style={BOX_LABEL}>No Fincla {skipped ? <SkipBadge /> : null}</div>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          {skipped ? "Este lançamento não entra no Fincla. A diferença aparece em Conferir o total." : "A compra sugerida não existe mais no Fincla. Escolha “Não registrar”."}
        </p>
      </section>
    );
  }
  const suggested = match.id === entry.suggested_transaction_id;
  const valueDiffers = match.differences.includes("amount");
  const dateDiffers = match.differences.includes("date");
  const day = match.installment ? match.purchase_date : (match.purchase_date ?? dayOf(match.date));
  const label = (
    <div style={BOX_LABEL}>
      No Fincla
      {suggested ? <SuggestedBadge /> : null}
      {!skipped && valueDiffers ? <DifferenceTag>VALOR DIFERENTE</DifferenceTag> : null}
      {skipped ? <SkipBadge /> : null}
    </div>
  );
  const rows = (
    <Fields
      rows={[
        [match.installment ? "Data da compra" : "Data", <Hl key="d" on={!skipped && dateDiffers}><span style={NUM}>{bankDateLabel(day)}</span></Hl>],
        ["Descrição", <span key="n"><b>{match.description}</b><InstallmentBadge installment={match.installment} /></span>],
        ["Valor", <Hl key="v" on={!skipped && valueDiffers}><FinclaAmount match={match} /></Hl>],
        ["Fatura", invoiceMonth],
        ["Categoria", [match.category_name ?? "Não classificado", ...match.tag_names].join(" · ")],
      ]}
    />
  );
  if (skipped) {
    return (
      <section data-testid="fincla-side-skipped" style={{ ...BOX, background: SKIP_BG, borderColor: T.inkFaint }}>
        {label}
        <div style={{ opacity: 0.6 }}>{rows}</div>
        <SkipNote>Continua no Fincla como está, sem mudança. Este lançamento do banco não entra no Fincla, e a diferença aparece em Conferir o total.</SkipNote>
      </section>
    );
  }
  return (
    <section data-testid="fincla-side" style={{ ...BOX, borderColor: entry.answer === "pair" ? T.blue : T.border, ...(onConfirm ? { position: "relative" } : null) }}>
      {label}
      {rows}
      {entry.answer === "pair" ? <PairConsequences entry={entry} /> : null}
      {onConfirm ? (
        // A sugestão intacta: clicar nela confirma, como o botão (o botão cobre a caixa sem embrulhar a lista).
        <button
          type="button"
          aria-label={`Confirmar que é ${match.description}, ${bankDateLabel(day)}`}
          onClick={onConfirm}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, padding: 0, border: 0, borderRadius: "inherit", background: "transparent", cursor: "pointer" }}
        />
      ) : null}
    </section>
  );
}

export function InvoiceStatusBadge({ entry }) {
  if (entry.answer === "reconciled") {
    return <Badge color={T.green} bg={T.greenLight}><Check size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Já conferido</Badge>;
  }
  if (!entry.answerable && entry.answer === "ignore") {
    return <Badge color={T.inkMid} bg={T.grayLight}>Fica de fora nesta versão</Badge>;
  }
  if (entry.answer === "pair" && !entry.confirmed) {
    return <Badge color={T.blue} bg={T.blueLight}><Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Sugerido · falta confirmar</Badge>;
  }
  if (entry.answer === "pair") return <Badge color={T.blue} bg={T.blueLight}><Link2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Já está no Fincla</Badge>;
  if (entry.answer === "ignore") return <SkipBadge />;
  return <Badge color={T.amber} bg={T.amberLight}>Falta responder</Badge>;
}

/** A sugestão sem nenhuma mudança: só aí aparece o "Confirmar sugestão" ao lado das respostas. */
export const untouchedInvoiceSuggestion = (entry) => entry.answer === "pair" && !entry.confirmed && Boolean(entry.fincla_transaction);

function outcomeText(entry) {
  const match = entry.fincla_transaction;
  if (entry.answer === "pair" && match) {
    if (entry.value_change) {
      return <>Ao concluir: <b>{match.description}</b> fica ligada a este lançamento da fatura e passa a valer <b style={NUM}>{formatMoney(entry.value_change.to, entry.value_change.currency)}</b>, o valor do banco.</>;
    }
    return <>Ao concluir: <b>{match.description}</b> fica ligada a este lançamento da fatura.</>;
  }
  if (entry.answer === "ignore") return <>Não entra no Fincla. A diferença aparece em Conferir o total.</>;
  return null;
}

function InvoicePairCard({ entry, invoiceMonth, isMobile, busy, canUndo, onAnswer, onUndoChoice }) {
  const valueDiffers = entry.answer === "pair" && Boolean(entry.fincla_transaction?.differences.includes("amount"));
  const outcome = outcomeText(entry);
  // Fatura já paga (decisão 1): o valor não muda. O motivo só aparece quando o valor do banco é outro.
  const paidNote = paidValueLocked(entry) ? PAID_INVOICE_REASON : null;
  const confirm = untouchedInvoiceSuggestion(entry)
    ? <ConfirmAnswerButton label="Confirmar sugestão" disabled={busy} touch={isMobile} onConfirm={() => onAnswer(entry, "pair")} />
    : null;
  return (
    <article
      data-testid="pair-card"
      aria-label={`Lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.answer === "pair" && !entry.confirmed ? T.blue : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <InvoiceStatusBadge entry={entry} />
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} touch={isMobile} /> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <InvoiceBankSide entry={entry} valueDiffers={valueDiffers} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <InvoiceFinclaSide
            entry={entry}
            invoiceMonth={invoiceMonth}
            skipped={entry.answer === "ignore"}
            onConfirm={untouchedInvoiceSuggestion(entry) && !busy ? () => onAnswer(entry, "pair") : null}
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
          onAnswer={(value) => onAnswer(entry, value)}
          confirm={confirm}
          note={paidNote}
          touch={isMobile}
        />
      </footer>
      {outcome ? (
        <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>{outcome}
        </p>
      ) : null}
    </article>
  );
}

function rowSummary(entry) {
  const match = entry.fincla_transaction;
  if (entry.answer === "pair" && match) {
    let tail = "";
    if (entry.value_change) tail = " · vale o valor do banco";
    else if (paidValueLocked(entry)) tail = " · fatura já paga: o valor não muda";
    return <>É <b>{match.description}</b>{tail}</>;
  }
  return <span style={{ color: T.inkLight }}>Fica fora do Fincla</span>;
}

/** Um par recolhido numa linha que continua visível; um clique em qualquer ponto a reabre. */
const InvoicePairRow = memo(function InvoicePairRowView({ entry, canUndo, focus = false, touch = false, onOpen, onUndoChoice }) {
  const alterRef = useRef(null);
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div data-testid="pair-row" onClick={openOnRowClick(() => onOpen(entry))} style={{ ...ROW_CLICKABLE, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", background: entry.answer === "ignore" ? SKIP_BG : "transparent", ...G, fontSize: 12, color: T.inkMid }}>
      <Btn
        ref={alterRef}
        variant="ghost"
        small
        onClick={() => onOpen(entry)}
        aria-label={`Alterar o lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
        style={{ color: T.blue, gap: 2, ...(touch ? { minHeight: TOUCH_TARGET } : null) }}
      >
        <ChevronRight size={13} aria-hidden="true" />Alterar
      </Btn>
      <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <InvoiceAmount amount={entry.amount} currency={entry.currency} />
      <InvoiceStatusBadge entry={entry} />
      <span style={{ flex: 1, minWidth: 160 }}>{rowSummary(entry)}</span>
      {isAnswered(entry) ? <ConferidoBadge /> : null}
      {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} inRow touch={touch} /> : null}
    </div>
  );
});

/** "Confirmar as 3 de uma vez"; com uma só, "Confirmar esta compra". */
export function confirmAllPurchasesLabel(count) {
  return count === 1 ? "Confirmar esta compra" : `Confirmar as ${count.toLocaleString("pt-BR")} de uma vez`;
}

/**
 * O passo 1 inteiro: "Confirmar as N de uma vez" com a faixa de desfazer, e a lista (só o atual
 * aberto). `history`: as respostas anteriores de cada lançamento, para "Desfazer escolha".
 */
export function InvoiceSuggestedStep({ entries, queue, invoiceMonth, isMobile, busy, history, lastBulk, onAnswer, onUndoChoice, onConfirmAll, onUndoConfirmAll }) {
  const unconfirmed = unconfirmedInvoiceSuggestions(entries);
  const openRow = useStableCallback((entry) => queue.open(entry.id));
  const undoChoice = useStableCallback(onUndoChoice);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <EntryQueueHeader queue={queue} shortcutKeys={["s", "n"]} noun={PURCHASE_NOUN} touch={isMobile} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...G, ...NUM, fontSize: 13, color: T.inkMid }}>{plural(entries.length, "compra encontrada", "compras encontradas")}</span>
        {unconfirmed.length ? (
          <>
            <Btn variant="dark" small disabled={busy} onClick={() => onConfirmAll(unconfirmed.map((e) => e.id))} style={isMobile ? { minHeight: TOUCH_TARGET } : undefined}>
              <Check size={13} aria-hidden="true" /> {confirmAllPurchasesLabel(unconfirmed.length)}
            </Btn>
            <span style={{ ...G, fontSize: 12, color: T.inkLight }}>Cada par continua com “Alterar” e “Desfazer escolha”.</span>
          </>
        ) : (
          <span style={{ ...G, fontSize: 12, color: T.green, fontWeight: 600 }}>Todas conferidas</span>
        )}
      </div>
      {lastBulk ? (
        <div role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Check size={14} aria-hidden="true" style={{ color: T.green }} />
          <span style={{ flex: 1 }}>{plural(lastBulk.length, "compra confirmada", "compras confirmadas")}.</span>
          <Btn variant="outGray" small onClick={onUndoConfirmAll} disabled={busy} style={isMobile ? { minHeight: TOUCH_TARGET } : undefined}>Desfazer</Btn>
        </div>
      ) : null}
      {entries.filter(queue.shown).map((entry) => (
        <EntrySlot key={entry.id} entryId={entry.id} open={entry.id === queue.currentId} tone={answerTone(entry.answer)}>
          {entry.id === queue.currentId ? (
            <CurrentEntryFrame queue={queue} entry={entry} noun={PURCHASE_NOUN}>
              <InvoicePairCard
                entry={entry}
                invoiceMonth={invoiceMonth}
                isMobile={isMobile}
                busy={busy}
                canUndo={Boolean(history[entry.id]?.length)}
                onAnswer={onAnswer}
                onUndoChoice={onUndoChoice}
              />
            </CurrentEntryFrame>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <InvoicePairRow entry={entry} canUndo={Boolean(history[entry.id]?.length)} focus={queue.rowFocusId === entry.id} touch={isMobile} onOpen={openRow} onUndoChoice={undoChoice} />
            </div>
          )}
        </EntrySlot>
      ))}
    </div>
  );
}

/**
 * Os lançamentos que uma conciliação concluída deste cartão já conferiu (reimportação do mesmo PDF,
 * fincla-api#556): só leitura, com a compra do Fincla a que estão ligados. Nada a clicar, nada
 * acontece com eles ao concluir, e nada se duplica.
 */
export function ReconciledEntries({ entries }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p role="note" style={{ ...G, fontSize: 13, color: T.ink, margin: 0, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "10px 12px" }}>
        {entries.length === 1
          ? "Este lançamento já foi conferido numa conciliação anterior desta fatura. Ele continua ligado à compra do Fincla e nada muda nele ao concluir."
          : `Estes ${entries.length.toLocaleString("pt-BR")} lançamentos já foram conferidos numa conciliação anterior desta fatura. Eles continuam ligados às compras do Fincla e nada muda neles ao concluir.`}
      </p>
      <div data-testid="reconciled-entries" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            data-testid="reconciled-row"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderTop: index ? `1px solid ${T.border}` : "none", ...G, fontSize: 12, color: T.inkMid }}
          >
            <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
            <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word", flex: "1 1 160px" }}>{entry.bank_description}</span>
            <InvoiceAmount amount={entry.amount} currency={entry.currency} />
            <InvoiceStatusBadge entry={entry} />
            {entry.fincla_transaction ? (
              <span style={{ flex: "1 1 160px", minWidth: 0 }}>É <b style={{ color: T.ink }}>{entry.fincla_transaction.description}</b></span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Os lançamentos de um passo que esta versão ainda não responde: só leitura, "Fica de fora nesta
 * versão" (resposta `ignore`, contam nos não registrados). Nada a clicar.
 */
export function ReadOnlyEntries({ entries }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p role="note" style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0, background: T.grayLight, borderRadius: 10, padding: "10px 12px" }}>
        Este passo ainda não pode ser respondido nesta versão. {entries.length === 1 ? "Este lançamento fica" : "Estes lançamentos ficam"} de fora: não {entries.length === 1 ? "entra" : "entram"} no Fincla, e a diferença aparece em Conferir o total.
      </p>
      <div data-testid="read-only-entries" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            data-testid="read-only-row"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderTop: index ? `1px solid ${T.border}` : "none", background: SKIP_BG, ...G, fontSize: 12, color: T.inkMid }}
          >
            <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
            <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word", flex: "1 1 160px" }}>{entry.bank_description}</span>
            <span style={{ color: T.inkLight }}>{SECTION_LABEL[entry.section] ?? entry.section}</span>
            <InvoiceAmount amount={entry.amount} currency={entry.currency} />
            <InvoiceStatusBadge entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
}
