// Conciliar fatura, passo 4 "Encargos, tarifas e estornos" (fincla-api#558, protótipo v16).
//
// Dois tipos de item na mesma fila (só o atual aberto, recolher no clique sem temporizador, linha
// parada, rodapé "Falta responder N ↑/↓"):
// - o GRUPO DE ENCARGOS (juros, mora, multa, IOF de financiamento), primeiro: um cartão para o grupo
//   inteiro, com os lançamentos e a Soma à esquerda (a mesma lista do "Somar" do extrato, #513) e, à
//   direita, a transação do Fincla cujo valor é a soma ("A soma bate"). Respostas: "Sim, somados em
//   <transação>" · "Não, adicionar cada um" · "Não registrar"; cada uma confirma e recolhe no clique,
//   e só a sugestão intacta tem "Confirmar sugestão". "Não registrar" deixa a transação somada à vista,
//   cinza listrada. Nenhum lançamento do grupo é respondido sozinho;
// - os outros (anuidade, redução, repasse de IOF, estornos): o passo "Compras novas" (#557), com o
//   formulário do item novo; crédito vira estorno, com a nota "Entra como estorno: diminui o total
//   da fatura".
// Nada muda no Fincla até "Concluir conciliação da fatura".
import { memo, useEffect, useRef } from "react";
import { ChevronRight, Info, Plus, Sparkles } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { BOX, BOX_LABEL, ConfirmAnswerButton, SKIP_BG, SkipBadge, bankDateLabel, categoryLabel } from "./StatementEntryCard.jsx";
import { AnswerSegment, Connector, UndoChoiceButton } from "./SuggestedPairsStep.jsx";
import { ConferidoBadge, CurrentEntryFrame, EntrySlot, ROW_CLICKABLE, answerTone, openOnRowClick } from "./entryQueue.jsx";
import { SummedEntryList } from "./NewEntriesStep.jsx";
import { CHARGE_QUESTION, InvoiceNewStep } from "./InvoiceNewStep.jsx";
import { InvoiceAmount, InvoiceFinclaSide, InvoiceStatusBadge, PAID_INVOICE_REASON } from "./InvoiceSuggestedStep.jsx";
import { isInvoiceEntryAnswered } from "./invoiceSteps.js";

/** As palavras da lista do passo: lançamentos da fatura (o grupo conta como um). */
export const CHARGE_NOUN = {
  title: "Lançamento",
  one: "lançamento",
  many: "lançamentos",
  answeredOne: "lançamento já respondido não aparece",
  answeredMany: "lançamentos já respondidos não aparecem",
  pendingOne: "lançamento sem resposta não aparece",
  pendingMany: "lançamentos sem resposta não aparecem",
};

export const GROUP_TITLE = "Encargos do mês";
const GROUP_QUESTION = "Estes encargos já estão no Fincla?";
/** Sem transação com o valor da soma: "Sim, somados em…" fica desligado, com o motivo. */
export const NO_SUM_MATCH_REASON = "Nenhuma transação desta fatura no Fincla tem o valor da soma.";

/** As respostas do grupo; "Sim" leva o nome da transação somada. */
export function chargeGroupAnswers(group) {
  const into = group.fincla_transaction?.description;
  return [
    { value: "pair_sum", label: into ? `Sim, somados em ${into}` : "Sim, somados numa transação", tone: T.blue },
    { value: "create", label: "Não, adicionar cada um", tone: T.green },
    { value: "ignore", label: "Não registrar", tone: T.inkLight },
  ];
}

/** A resposta do grupo não está disponível? Uma regra só para o botão e para o atalho (S/A/N). */
export function chargeGroupAnswerUnavailable(group, value) {
  if (value === "pair_sum") return !group.suggested_transaction_id;
  if (value === "create") return !group.addable;
  return false;
}

/** O motivo escrito ao lado das respostas desligadas do grupo; `null` = nenhuma. */
export function chargeGroupAnswerNote(group) {
  const notes = [
    !group.addable ? PAID_INVOICE_REASON : null,
    !group.suggested_transaction_id ? NO_SUM_MATCH_REASON : null,
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : null;
}

/** A sugestão sem nenhuma mudança ("A soma bate", ainda sem a confirmação da pessoa). */
export const untouchedChargeGroup = (group) => group.answer === "pair_sum" && !group.confirmed && Boolean(group.fincla_transaction);

/** O selo do grupo, no cartão e na linha. */
export function ChargeGroupBadge({ group }) {
  if (group.answer === null) return <Badge color={T.amber} bg={T.amberLight}>Falta responder</Badge>;
  if (group.answer === "ignore") return <SkipBadge />;
  const waiting = group.answerable && !group.confirmed ? " · falta confirmar" : "";
  if (group.answer === "create") {
    return <Badge color={T.green} bg={T.greenLight}><Plus size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Adicionar cada um{waiting}</Badge>;
  }
  return <InvoiceStatusBadge entry={{ answer: "pair_sum", answerable: group.answerable, confirmed: group.confirmed }} />;
}

/** Os lançamentos do grupo e a Soma, como a fatura mostra (cobrança sem sinal). */
function GroupBankSide({ item }) {
  const { group, members } = item;
  return (
    <section data-testid="bank-side" style={{ ...BOX, background: group.answer === "ignore" ? SKIP_BG : T.bg }}>
      <div style={BOX_LABEL}>Na fatura do banco · {plural(members.length, "lançamento", "lançamentos")}</div>
      <SummedEntryList
        label="Lançamentos do grupo de encargos"
        entries={members}
        amountOf={(e) => <InvoiceAmount amount={e.amount} currency={e.currency} />}
        total={<InvoiceAmount amount={group.total} currency={group.currency} strong />}
        style={{ padding: 0, background: "transparent" }}
      />
    </section>
  );
}

const CONS = { ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", lineHeight: 1.5 };
const CTAG = { fontSize: 11, fontWeight: 700, color: T.blue, background: T.blueLight, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" };

function SumMatchBadge() {
  return (
    <span data-testid="sum-matches">
      <Badge color={T.blue} bg={T.blueLight}><Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />A soma bate</Badge>
    </span>
  );
}

/** Os lançamentos que "Não, adicionar cada um" cria: um por lançamento, com a descrição e a categoria de cada um. */
function GroupCreateSide({ item, form }) {
  const { group, members } = item;
  const kept = group.fincla_transaction;
  return (
    <section data-testid="charge-group-create" style={{ ...BOX, borderColor: T.greenBorder }}>
      <div style={BOX_LABEL}>
        Novas transações no Fincla <Badge color={T.green} bg={T.greenLight}>Entram ao concluir</Badge>
      </div>
      <p style={{ ...G, fontSize: 13, color: T.ink, margin: "0 0 8px" }}>
        Entram {plural(members.length, "transação", "transações")}, uma para cada lançamento, no cartão, na data do banco:
      </p>
      <ul aria-label="Transações que entram no Fincla" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {members.map((e) => (
          <li key={e.id} data-testid="charge-group-new" style={{ ...G, fontSize: 12, color: T.inkMid, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <b style={{ color: T.ink, flex: "1 1 140px", minWidth: 0, wordBreak: "break-word" }}>{e.description?.trim() || "(sem descrição)"}</b>
            <span>{categoryLabel(form.categories, e.category_tag_id, form.fallbackLabel)}</span>
            <InvoiceAmount amount={e.amount} currency={e.currency} />
          </li>
        ))}
      </ul>
      {kept ? (
        <div style={CONS}>
          <Info size={13} aria-hidden="true" style={{ alignSelf: "center", flexShrink: 0 }} />
          <span><b>{kept.description}</b> continua no Fincla como está, sem mudança. A diferença aparece em Conferir o total.</span>
        </div>
      ) : null}
    </section>
  );
}

/** O lado direito do cartão do grupo, pela resposta. */
function GroupFinclaSide({ item, form, invoiceMonth, busy, onConfirmSuggestion }) {
  const { group, members } = item;
  const match = group.fincla_transaction;
  const count = plural(members.length, "lançamento", "lançamentos");
  if (group.answer === "create") return <GroupCreateSide item={item} form={form} />;
  if (!match) {
    const skipped = group.answer === "ignore";
    return (
      <section data-testid={skipped ? "fincla-side-skipped" : "fincla-side-none"} style={{ ...BOX, background: skipped ? SKIP_BG : T.grayLight }}>
        <div style={BOX_LABEL}>No Fincla {skipped ? <SkipBadge /> : null}</div>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          {skipped
            ? "Estes lançamentos do banco não entram no Fincla. A diferença aparece em Conferir o total."
            : `${NO_SUM_MATCH_REASON} Adicione cada um ou escolha “Não registrar”.`}
        </p>
      </section>
    );
  }
  // A transação somada pela caixa do passo 1: o par é o grupo inteiro (o rótulo diz "A soma bate").
  const asEntry = { fincla_transaction: match, suggested_transaction_id: group.suggested_transaction_id, answer: group.answer === "pair_sum" ? "pair" : group.answer };
  if (group.answer === "ignore") {
    return (
      <InvoiceFinclaSide
        entry={asEntry}
        invoiceMonth={invoiceMonth}
        skipped
        skipText={`Estes ${members.length.toLocaleString("pt-BR")} lançamentos do banco não entram no Fincla. ${match.description} continua como está, sem mudança, e a diferença aparece em Conferir o total.`}
      />
    );
  }
  return (
    <InvoiceFinclaSide
      entry={asEntry}
      invoiceMonth={invoiceMonth}
      badge={<SumMatchBadge />}
      consequences={(
        <div data-testid="sum-consequences" style={CONS}>
          <span style={CTAG}>Somado</span>
          <span>
            <b>{match.description}</b> (<span style={NUM}>{formatMoney(match.value, match.currency)}</span>) tem o mesmo valor que a soma destes {count}. Se for isso, nada novo é criado: ela fica ligada a todos eles.
          </span>
        </div>
      )}
      onConfirm={untouchedChargeGroup(group) && !busy ? onConfirmSuggestion : null}
    />
  );
}

function groupOutcome(item) {
  const { group, members } = item;
  const match = group.fincla_transaction;
  if (group.answer === "pair_sum" && match) {
    return <>Ao concluir: os {members.length.toLocaleString("pt-BR")} lançamentos ficam ligados a <b>{match.description}</b>. Nada mais muda nela.</>;
  }
  if (group.answer === "create") return <>Ao concluir: entram {plural(members.length, "transação nova", "transações novas")} no Fincla, uma por lançamento.</>;
  if (group.answer === "ignore") return <>Não entram no Fincla. A diferença aparece em Conferir o total.</>;
  return null;
}

/** O cartão aberto do grupo de encargos. */
function ChargeGroupCard({ item, form, invoiceMonth, isMobile, busy, canUndo, onAnswer, onUndoChoice }) {
  const { group } = item;
  const outcome = groupOutcome(item);
  const confirm = untouchedChargeGroup(group)
    ? <ConfirmAnswerButton label="Confirmar sugestão" disabled={busy} touch={isMobile} onConfirm={() => onAnswer(item, "pair_sum")} />
    : null;
  let connector = group.answer;
  if (group.answer === "pair_sum") connector = "pair";
  return (
    <article
      data-testid="charge-group-card"
      aria-label={`${GROUP_TITLE}: ${plural(item.members.length, "lançamento", "lançamentos")}`}
      style={{ background: T.surface, border: `1px solid ${untouchedChargeGroup(group) ? T.blue : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <b style={{ ...G, fontSize: 13, color: T.ink }}>{GROUP_TITLE}</b>
        <ChargeGroupBadge group={group} />
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={item} onUndoChoice={onUndoChoice} touch={isMobile} /> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <GroupBankSide item={item} />
        <Connector answer={connector} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <GroupFinclaSide item={item} form={form} invoiceMonth={invoiceMonth} busy={busy} onConfirmSuggestion={() => onAnswer(item, "pair_sum")} />
        </div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerSegment
          label={GROUP_QUESTION}
          answers={chargeGroupAnswers(group)}
          value={group.answer}
          busy={busy}
          unavailable={(a) => chargeGroupAnswerUnavailable(group, a.value)}
          onAnswer={(value) => onAnswer(item, value)}
          confirm={confirm}
          note={chargeGroupAnswerNote(group)}
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

function rowSummary(item) {
  const { group, members } = item;
  if (group.answer === "pair_sum") return <>Somados em <b>{group.fincla_transaction?.description ?? "uma transação do Fincla"}</b></>;
  if (group.answer === "create") return <>Entram {plural(members.length, "transação", "transações")}</>;
  return <span style={{ color: T.inkLight }}>Ficam fora do Fincla</span>;
}

/** O grupo recolhido numa linha que continua visível; um clique em qualquer ponto a reabre. */
const ChargeGroupRow = memo(function ChargeGroupRowView({ item, canUndo, focus = false, touch = false, onOpen, onUndoChoice }) {
  const alterRef = useRef(null);
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  const { group, members } = item;
  return (
    <div
      data-testid="charge-group-row"
      onClick={openOnRowClick(() => onOpen(item))}
      style={{ ...ROW_CLICKABLE, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", background: group.answer === "ignore" ? SKIP_BG : T.surface, border: `1px solid ${T.border}`, borderRadius: 12, ...G, fontSize: 12, color: T.inkMid }}
    >
      <Btn
        ref={alterRef}
        variant="ghost"
        small
        onClick={() => onOpen(item)}
        aria-label={`Alterar ${GROUP_TITLE.toLowerCase()}`}
        style={{ color: T.blue, gap: 2, ...(touch ? { minHeight: TOUCH_TARGET } : null) }}
      >
        <ChevronRight size={13} aria-hidden="true" />Alterar
      </Btn>
      <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(item.date)}</span>
      <span style={{ color: T.ink, fontWeight: 600, minWidth: 0 }}>{GROUP_TITLE} · {plural(members.length, "lançamento", "lançamentos")}</span>
      <InvoiceAmount amount={group.total} currency={group.currency} />
      <ChargeGroupBadge group={group} />
      <span style={{ flex: 1, minWidth: 160 }}>{rowSummary(item)}</span>
      {isInvoiceEntryAnswered(item) ? <ConferidoBadge /> : null}
      {canUndo ? <UndoChoiceButton entry={item} onUndoChoice={onUndoChoice} inRow touch={touch} /> : null}
    </div>
  );
});

/**
 * O passo 4 inteiro. `queue` é a fila do passo (o grupo primeiro, `groupItem`); `entries` são os
 * outros lançamentos (Adicionar · Não registrar). `onAnswerGroup(item, value)` responde o grupo e o
 * recolhe; `onUndoGroup(item)` é o "Desfazer escolha" dele; `groupHistory` diz se há o que desfazer.
 * O resto é o do passo "Compras novas" (`InvoiceNewStep`).
 */
export function InvoiceChargesStep({
  groupItem, entries, queue, form, invoiceMonth, isMobile, answering, groupHistory = [],
  onAnswerGroup, onUndoGroup, onChangeEntry, onConfirmEntry, answeredRef = null,
}) {
  const leading = groupItem && queue.shown(groupItem) ? (
    <EntrySlot key={groupItem.id} entryId={groupItem.id} open={groupItem.id === queue.currentId} tone={answerTone(groupItem.answer === "pair_sum" ? "pair" : groupItem.answer)}>
      {groupItem.id === queue.currentId ? (
        <CurrentEntryFrame queue={queue} entry={groupItem} noun={CHARGE_NOUN}>
          <ChargeGroupCard
            item={groupItem}
            form={form}
            invoiceMonth={invoiceMonth}
            isMobile={isMobile}
            busy={answering}
            canUndo={groupHistory.length > 0}
            onAnswer={onAnswerGroup}
            onUndoChoice={onUndoGroup}
          />
        </CurrentEntryFrame>
      ) : (
        <ChargeGroupRow
          item={groupItem}
          canUndo={groupHistory.length > 0}
          focus={queue.rowFocusId === groupItem.id}
          touch={isMobile}
          onOpen={(item) => queue.open(item.id)}
          onUndoChoice={onUndoGroup}
        />
      )}
    </EntrySlot>
  ) : null;
  return (
    <InvoiceNewStep
      stepKey="charges"
      entries={entries}
      queue={queue}
      form={form}
      isMobile={isMobile}
      answering={answering}
      onChangeEntry={onChangeEntry}
      onConfirmEntry={onConfirmEntry}
      answeredRef={answeredRef}
      question={CHARGE_QUESTION}
      cardLabel="Lançamento"
      leading={leading}
      shortcutKeys={groupItem ? ["s", "a", "n"] : ["a", "n"]}
    />
  );
}
