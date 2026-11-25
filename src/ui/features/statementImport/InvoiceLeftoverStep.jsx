// Conciliar fatura, passo 6 "Sobrando no Fincla" (fincla-api#560): as transações desta fatura no
// Fincla que o banco não cobrou. Cada uma pede uma decisão: Manter · Mover para a próxima fatura ·
// Excluir (vermelho listrado). Decidir já confirma e recolhe a linha no clique, sem temporizador; a
// linha fica parada, com "Conferido", "Alterar" e "Desfazer escolha". Nada muda no Fincla até
// concluir. Fatura paga (decisão 1): só Manter; mover e excluir desligados com o motivo do backend.
// A dica de cada item (só valor e dia, nunca texto) diz por que ele pode estar sobrando. Mesmo molde
// das transações sem par do "Conferir o saldo" do extrato (`BalanceCheckStep`).
import { memo } from "react";
import { Check, Info } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney } from "../../money/formatMoney.js";
import { DELETE_BG, DELETE_CARD_BG, bankDateLabel } from "./StatementEntryCard.jsx";
import { ConferidoBadge, CurrentEntryFrame, EntryQueueHeader, EntrySlot, ROW_CLICKABLE, openOnRowClick } from "./entryQueue.jsx";
import { invoiceMonthLabel } from "./invoiceSteps.js";

/** As palavras da lista do passo. */
export const LEFTOVER_NOUN = {
  title: "Item",
  one: "item",
  many: "itens",
  answeredOne: "item já decidido não aparece",
  answeredMany: "itens já decididos não aparecem",
  pendingOne: "item sem decisão não aparece",
  pendingMany: "itens sem decisão não aparecem",
};

/** O id do item na fila (o da transação). */
export const leftoverItemId = (item) => `leftover-${item.transaction.id}`;

/**
 * O item sobrando como um item da fila do passo: a decisão é a resposta e já vem confirmada (decidir
 * confirma). `leftover` é o item como o backend o mandou.
 */
export const leftoverQueueItem = (item) => ({
  id: leftoverItemId(item),
  kind: "leftover",
  classification: "leftover",
  answerable: true,
  answer: item.action,
  confirmed: true,
  date: item.transaction.purchase_date ?? String(item.transaction.date).slice(0, 10),
  leftover: item,
});

const ROW = { ...G, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface };
const NOTE = { ...G, fontSize: 13, color: T.ink, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" };

/** "a fatura de janeiro/2027" (a seguinte; ainda não existe → é criada ao concluir). */
function nextInvoiceText(leftovers) {
  const year = leftovers?.next_invoice?.year ?? leftovers?.next_invoice_year;
  const month = leftovers?.next_invoice?.month ?? leftovers?.next_invoice_month;
  return year && month ? `a fatura de ${invoiceMonthLabel({ year, month })}` : "a próxima fatura";
}

const dayOf = (ymd) => (ymd ? bankDateLabel(String(ymd).slice(0, 10)) : "");

/** Por que o item pode estar sobrando (a primeira dica que vale, do backend). */
export function leftoverHintText(hint, entries = []) {
  if (!hint) return null;
  if (hint.code === "option_not_chosen") {
    if (hint.charge_group_id) return "Era a transação que somava os encargos desta fatura, mas o grupo de encargos foi respondido de outro jeito.";
    const what = hint.entry_bank_description ? `“${hint.entry_bank_description}”${hint.entry_date ? ` (${dayOf(hint.entry_date)})` : ""}` : "um lançamento do banco";
    if (hint.chosen_description) return `Era uma das opções para ${what}, mas você escolheu “${hint.chosen_description}”.`;
    const answer = entries.find((e) => e.id === hint.entry_id)?.answer;
    if (answer === "create") return `Era uma das opções para ${what}, mas o lançamento foi adicionado como novo.`;
    if (answer === "ignore") return `Era uma das opções para ${what}, mas o lançamento ficou como não registrado.`;
    return `Era uma das opções para ${what}, mas não foi a escolhida.`;
  }
  if (hint.code === "looks_duplicated") {
    return `Parece lançada duas vezes: tem o mesmo valor e o mesmo dia de ${hint.twin_description ? `“${hint.twin_description}”` : "outra compra"}, que já está ligada ao banco.`;
  }
  if (hint.code === "maybe_repeated") {
    return `Pode ser repetida: tem o mesmo valor de ${hint.twin_description ? `“${hint.twin_description}”` : "outra compra"}, que já está ligada ao banco.`;
  }
  if (hint.code === "maybe_next_invoice") return "O banco não cobrou isto nesta fatura. Talvez seja da próxima.";
  return null;
}

const DELETE_REFUSAL = {
  invoice_paid: "Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.",
  goal: "Ligada a um aporte de meta: desfaça o aporte na meta para poder excluir.",
  refunded: "Tem um estorno ligado a ela: cuide do estorno em Lançamentos para poder excluir.",
};
const MOVE_REFUSAL = {
  invoice_paid: "Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.",
  other_invoice_paid: "A próxima fatura já foi paga: não dá para mover para ela.",
};

/** O motivo de uma ação desligada (a mensagem do backend; sem ela, a do código). `null` = ligada. */
export function leftoverRefusal(item, action) {
  if (action === "move_next" && !item.movable) return item.move_refusal?.message || MOVE_REFUSAL[item.move_refusal?.code] || "Não dá para mover este item agora.";
  if (action === "delete" && !item.deletable) return item.delete_refusal?.message || DELETE_REFUSAL[item.delete_refusal?.code] || "Não dá para excluir este item agora.";
  return null;
}

/** O que a decisão faz ao concluir, na linha recolhida e no cartão. */
function ActionState({ item, leftovers }) {
  if (item.action === "delete") return <Badge color={T.red} bg={T.redLight}>Será excluída ao concluir</Badge>;
  if (item.action === "move_next") return <Badge color={T.blue} bg={T.blueLight}>Vai para {nextInvoiceText(leftovers)} ao concluir</Badge>;
  if (item.action === "keep") return <Badge color={T.green} bg={T.greenLight}>Fica nesta fatura, como está</Badge>;
  return null;
}

function LeftoverFacts({ item }) {
  const tx = item.transaction;
  const struck = item.action === "delete";
  const strike = struck ? { textDecoration: "line-through" } : null;
  return (
    <>
      <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ fontSize: 13, color: T.ink, wordBreak: "break-word", ...strike }}>{tx.description}</b>
          {tx.installment ? <Badge>{`${String(tx.installment.number).padStart(2, "0")}/${String(tx.installment.count).padStart(2, "0")}`}</Badge> : null}
          {tx.type === "refund" ? <Badge>estorno</Badge> : null}
        </span>
        <span style={{ ...NUM, fontSize: 12, color: T.inkLight, ...strike }}>
          {dayOf(tx.purchase_date ?? tx.date)}{tx.category_name ? ` · ${tx.category_name}` : ""} · está nesta fatura no Fincla e o banco não cobrou
        </span>
      </div>
      <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: tx.type === "refund" ? T.green : T.ink, flexShrink: 0, ...strike }}>
        {tx.type === "refund" ? "−" : ""}{formatMoney(tx.value, tx.currency)}
      </span>
    </>
  );
}

const ACTIONS = [
  { value: "keep", label: "Manter" },
  { value: "move_next", label: "Mover para a próxima fatura" },
  { value: "delete", label: "Excluir" },
];

/** O cartão aberto: a dica e as três decisões (a desligada com o motivo). */
function LeftoverCard({ item, leftovers, entries, busy, onDecide, onUndo, canUndo, touch }) {
  const hint = leftoverHintText(item.hint, entries);
  const deleted = item.action === "delete";
  const reasons = ACTIONS.map((a) => ({ ...a, refusal: leftoverRefusal(item, a.value) }));
  const refusals = [...new Set(reasons.map((a) => a.refusal).filter(Boolean))];
  const txId = item.transaction.id;
  return (
    <div
      data-testid="leftover-item"
      data-current="true"
      data-action={item.action ?? undefined}
      role="group"
      aria-label={`Sobrando no Fincla: ${item.transaction.description}`}
      style={{ ...ROW, flexDirection: "column", alignItems: "stretch", borderColor: T.blue, ...(deleted ? { background: DELETE_CARD_BG, borderColor: T.redBar } : null) }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <LeftoverFacts item={item} />
      </div>
      {hint ? (
        <p data-testid="leftover-hint" data-code={item.hint.code} style={{ ...NOTE, background: T.amberLight, border: `1px solid ${T.amberBorder}`, margin: 0 }}>
          <Info size={14} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
          <span>{hint}</span>
        </p>
      ) : null}
      <div role="group" aria-label="O que fazer com este item" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {reasons.map((a) => {
          const on = item.action === a.value;
          const variant = on ? (a.value === "delete" ? "red" : a.value === "keep" ? "green" : "blue") : a.value === "delete" ? "outRed" : "outGray";
          const describedBy = a.refusal ? `leftover-refusal-${txId}-${refusals.indexOf(a.refusal)}` : undefined;
          return (
            <Btn
              key={a.value}
              variant={variant}
              small={!touch}
              aria-pressed={on}
              aria-describedby={describedBy}
              disabled={busy || Boolean(a.refusal)}
              onClick={() => onDecide(item, a.value)}
            >
              {on ? <Check size={12} aria-hidden="true" style={{ marginRight: 4 }} /> : null}
              {a.label}
            </Btn>
          );
        })}
      </div>
      {refusals.map((text, i) => (
        <span key={text} id={`leftover-refusal-${txId}-${i}`} data-testid="leftover-refusal" style={{ ...G, fontSize: 12, color: T.inkMid }}>{text}</span>
      ))}
      {item.action ? (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <ActionState item={item} leftovers={leftovers} />
          {canUndo ? <Btn variant="outGray" small={!touch} disabled={busy} onClick={() => onUndo(item)}>Desfazer escolha</Btn> : null}
        </span>
      ) : null}
    </div>
  );
}

/** A linha recolhida: a decisão, "Conferido", "Alterar" e "Desfazer escolha"; clicar reabre. */
const LeftoverRow = memo(function LeftoverRowView({ item, leftovers, busy, onOpen, onUndo, canUndo, touch }) {
  return (
    <div
      data-testid="leftover-item"
      data-action={item.action ?? undefined}
      onClick={openOnRowClick(onOpen)}
      style={{ ...ROW, ...ROW_CLICKABLE, flexDirection: "column", alignItems: "stretch", ...(item.action === "delete" ? { background: DELETE_BG, borderColor: T.redBar } : null) }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Btn variant="ghost" small={!touch} onClick={onOpen} style={{ color: T.blue }} aria-label={`Alterar ${item.transaction.description}`}>Alterar</Btn>
        <LeftoverFacts item={item} />
      </div>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <ActionState item={item} leftovers={leftovers} />
        {item.action ? <ConferidoBadge /> : null}
        {item.action && canUndo ? <Btn variant="ghost" small={!touch} disabled={busy} onClick={() => onUndo(item)}>Desfazer escolha</Btn> : null}
      </span>
    </div>
  );
});

/**
 * O passo inteiro. `items` são os itens da fila (`leftoverQueueItem`); `history` guarda as decisões
 * anteriores de cada um ("Desfazer escolha"; sem anterior, volta a "falta decidir").
 */
export function InvoiceLeftoverStep({ leftovers, loading, error, items, queue, entries, busy, history, isMobile, pendingText, onDecide, onUndo }) {
  if (!leftovers) {
    if (error) return null;
    return <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>{loading ? "Carregando o que sobrou no Fincla…" : null}</p>;
  }
  const waiting = leftovers.waiting_transactions;
  return (
    <div data-testid="leftover-step" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {waiting ? (
        <p data-testid="leftover-waiting" role="note" style={{ ...NOTE, background: T.blueLight, margin: 0 }}>
          <Info size={14} aria-hidden="true" style={{ color: T.blue, flexShrink: 0, marginTop: 2 }} />
          <span>
            {waiting === 1
              ? "1 item ainda é candidato de um caso com dúvida e não aparece aqui até você responder."
              : `${waiting.toLocaleString("pt-BR")} itens ainda são candidatos de um caso com dúvida e não aparecem aqui até você responder.`}
          </span>
        </p>
      ) : null}
      {!items.length ? (
        <p data-testid="leftover-empty" style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0, padding: "12px 14px", border: `1px dashed ${T.border}`, borderRadius: 12 }}>
          Nada sobrando: tudo o que está nesta fatura no Fincla o banco cobrou.
        </p>
      ) : (
        <>
          <EntryQueueHeader queue={queue} shortcutKeys={[]} noun={LEFTOVER_NOUN} touch={isMobile} pendingText={pendingText} />
          {items.filter(queue.shown).map((queued) => {
            const item = queued.leftover;
            const canUndo = Boolean(history[queued.id]?.length);
            return (
              <EntrySlot key={queued.id} entryId={queued.id} open={queued.id === queue.currentId} tone={item.action === "delete" ? T.red : T.blue}>
                {queued.id === queue.currentId ? (
                  <CurrentEntryFrame queue={queue} entry={queued} noun={LEFTOVER_NOUN}>
                    <LeftoverCard
                      item={item}
                      leftovers={leftovers}
                      entries={entries}
                      busy={busy}
                      canUndo={canUndo}
                      touch={isMobile}
                      onDecide={(it, action) => onDecide(queued, it, action)}
                      onUndo={() => onUndo(queued)}
                    />
                  </CurrentEntryFrame>
                ) : (
                  <LeftoverRow
                    item={item}
                    leftovers={leftovers}
                    busy={busy}
                    canUndo={canUndo}
                    touch={isMobile}
                    onOpen={() => queue.open(queued.id)}
                    onUndo={() => onUndo(queued)}
                  />
                )}
              </EntrySlot>
            );
          })}
        </>
      )}
    </div>
  );
}

/** "N itens para decidir" do trilho e do resumo. */
export const leftoverPendingText = (count) => plural(count, "item para decidir", "itens para decidir");
