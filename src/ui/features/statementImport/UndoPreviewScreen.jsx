// A prévia e a confirmação do desfazer, comuns ao Conciliar extrato (fincla-api#509) e ao Conciliar
// fatura (fincla-api#556). A prévia vem pronta do backend (a tela não recalcula nada); desfazer só
// depois de a pessoa confirmar AQUI, na página (nunca `window.confirm`); quando não dá, o motivo do
// backend aparece no lugar do botão. As palavras mudam por fluxo (`words`): "importação" no extrato,
// "conciliação" na fatura.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Undo2 } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn, Card } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney } from "../../money/formatMoney.js";
import { handleApiError } from "../../../api/client";
import { bankDateLabel, dayMonthLabel } from "./StatementEntryCard.jsx";
import { invoiceLabel } from "./InvoicePaymentStep.jsx";
import { ErrorNote } from "./StatementImportNotes.jsx";

/** As palavras do desfazer do extrato (o texto aprovado da #509). */
export const STATEMENT_UNDO_WORDS = {
  noun: "importação",
  reimport: "importar o extrato de novo",
  restoreTail: "",
};

/** As da fatura (#556): desfazer também tira a marca de conferida das compras ligadas. */
export const INVOICE_UNDO_WORDS = {
  noun: "conciliação",
  reimport: "enviar o PDF da fatura de novo",
  restoreTail: " e deixam de estar conferidas",
  restoreTailOne: " e deixa de estar conferida",
};

/** No celular, cada botão tem a altura de um alvo de toque; no computador fica como era. */
export const touchHeight = (touch) => (touch ? { minHeight: TOUCH_TARGET } : undefined);

/** Como a tela chama cada campo que mudou depois da conclusão (`changed_fields` da API). */
export const CHANGED_FIELD_LABEL = {
  description: "descrição",
  value: "valor",
  type: "tipo",
  date: "data",
  status: "situação",
  paid_at: "data de pagamento",
  account: "conta",
  payment_method: "forma de pagamento",
  tags: "categoria ou etiquetas",
  credit_card: "cartão",
  paid_date: "data de pagamento",
};

const INVOICE_STATUS_LABEL = { open: "em aberto", closed: "fechada" };

const fieldList = (fields) => fields.map((f) => CHANGED_FIELD_LABEL[f] ?? f).join(", ");

function DeletedTransactionRow({ transaction }) {
  const changed = fieldList(transaction.changed_fields);
  return (
    <li data-testid="undo-transaction" style={{ ...G, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 13, color: T.ink, overflowWrap: "anywhere" }}>
          <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(transaction.date)}</span> · {transaction.description}
        </span>
        {transaction.edited_after ? (
          <span>
            <Badge color={T.amber} bg={T.amberLight}>Editada depois: {changed}</Badge>
          </span>
        ) : null}
      </span>
      <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: transaction.type === "expense" ? T.ink : T.green }}>
        {transaction.type === "expense" ? "−" : "+"}{formatMoney(transaction.amount, transaction.currency)}
      </span>
    </li>
  );
}

/**
 * Uma transação que já estava no Fincla (pareada na conciliação): volta só o que a conciliação
 * mudou nela. O que a pessoa editou depois fica — aviso, não recusa.
 */
function RestoredTransactionRow({ entity }) {
  return (
    <li data-testid="undo-restored" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.ink, overflowWrap: "anywhere" }}>{entity.description}</span>
      {entity.edited_after ? (
        <span>
          <Badge color={T.amber} bg={T.amberLight}>Editada depois: {fieldList(entity.changed_fields)}</Badge>
        </span>
      ) : null}
      <span style={{ fontSize: 12, color: T.inkMid }}>
        {entity.action === "deleted"
          ? "Volta a existir como era antes da conciliação."
          : entity.edited_after
            ? "Volta só o que a conciliação mudou; o que você editou depois continua como está."
            : "Volta ao que era antes da conciliação."}
      </span>
      {entity.value_back != null ? (
        <span data-testid="undo-value-back" style={{ fontSize: 12, color: T.ink }}>
          O valor volta a <b style={NUM}>{formatMoney(entity.value_back, entity.value_back_currency)}</b> (a conciliação tinha posto o valor do banco).
        </span>
      ) : null}
      {entity.date_back ? (
        <span data-testid="undo-date-back" style={{ ...NUM, fontSize: 12, color: T.ink }}>
          A data volta a <b>{dayMonthLabel(entity.date_back)}</b> (a conciliação tinha mudado para {dayMonthLabel(entity.date_changed_to)}).
        </span>
      ) : null}
      {entity.account_back ? (
        <span data-testid="undo-account-back" style={{ fontSize: 12, color: T.ink }}>
          Volta para a conta <b>{entity.account_back.name ?? "de antes"}</b> (a conciliação a tinha movido para esta).
        </span>
      ) : null}
      {entity.kept_fields?.length ? (
        <span data-testid="undo-kept" style={{ fontSize: 12, color: T.inkMid }}>
          Você mudou de novo depois: fica como você deixou ({fieldList(entity.kept_fields)}).
        </span>
      ) : null}
    </li>
  );
}

/**
 * Uma fatura que a conciliação pagou (fincla-api#512): volta a ficar em aberto, sem data de
 * pagamento, e o saldo volta. Se a pessoa desmarcou ou pagou de novo depois, fica como ela deixou.
 */
function RestoredInvoiceRow({ entity }) {
  const { invoice } = entity;
  const label = invoiceLabel(invoice);
  return (
    <li data-testid="undo-restored-invoice" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.ink, overflowWrap: "anywhere" }}>{label}</span>
      {entity.edited_after ? (
        <span>
          <Badge color={T.amber} bg={T.amberLight}>Editada depois: {fieldList(entity.changed_fields)}</Badge>
        </span>
      ) : null}
      <span style={{ fontSize: 12, color: T.inkMid }}>
        {invoice.status_back
          ? <>Volta a ficar <b>{INVOICE_STATUS_LABEL[invoice.status_back] ?? "em aberto"}</b>, sem data de pagamento (a conciliação a tinha pago na data do banco).</>
          : "Você mudou o pagamento dela depois da conciliação: fica como você deixou."}
      </span>
    </li>
  );
}

/** "Volta a ficar em aberto" / "Volta a ficar fechada": a situação de antes da conciliação (fincla-api#512). */
const statusBackText = (statusBack) => `volta a ficar ${INVOICE_STATUS_LABEL[statusBack] ?? "em aberto"}`;

function WhatHappens({ preview, words }) {
  const { summary } = preview;
  const invoices = preview.to_restore.filter((r) => r.entity_type === "invoice");
  // As três partes do que volta vêm contadas pelo backend (G3-3-13): a tela não subtrai.
  const restoredTransactions = summary.restored_transactions;
  // Excluídas na conferência de saldo (fincla-api#514): voltam a existir, contadas à parte.
  const recreated = summary.recreated_transactions;
  return (
    <ul style={{ ...G, fontSize: 14, color: T.ink, margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Com zero, nenhuma frase de "0 transações" (smoke em dev). */}
      {summary.to_delete ? (
        <li data-testid="undo-delete-count">
          <b style={NUM}>{plural(summary.to_delete, "transação adicionada", "transações adicionadas")}</b>{" "}
          {summary.to_delete === 1 ? "será apagada" : "serão apagadas"}
          {summary.edited_after ? (
            <span style={{ color: T.amber }}>
              {" "}({plural(summary.edited_after, "editada", "editadas")} depois da conciliação — {summary.edited_after === 1 ? "essa também some" : "essas também somem"})
            </span>
          ) : null}
        </li>
      ) : null}
      {restoredTransactions ? (
        <li data-testid="undo-restore-count">
          <b style={NUM}>{plural(restoredTransactions, "transação que já estava", "transações que já estavam")}</b> no Fincla{" "}
          {restoredTransactions === 1 ? "volta" : "voltam"} ao estado de antes da conciliação
          {restoredTransactions === 1 ? (words.restoreTailOne ?? words.restoreTail) : words.restoreTail}
        </li>
      ) : null}
      {recreated ? (
        <li data-testid="undo-recreated-count">
          <b style={NUM}>{plural(recreated, "transação excluída na conferência de saldo", "transações excluídas na conferência de saldo")}</b>{" "}
          {recreated === 1 ? "volta a existir" : "voltam a existir"}
        </li>
      ) : null}
      {invoices.filter((r) => r.invoice?.status_back).map((r) => (
        <li key={r.entity_id} data-testid="undo-invoice-reopens">
          A <b>{invoiceLabel(r.invoice)}</b> {statusBackText(r.invoice.status_back)}
        </li>
      ))}
      {summary.already_deleted ? (
        <li data-testid="undo-already-deleted" style={{ color: T.inkMid }}>
          {plural(summary.already_deleted, "transação da conciliação já foi excluída", "transações da conciliação já foram excluídas")} por você: nada a fazer com {summary.already_deleted === 1 ? "ela" : "elas"}
        </li>
      ) : null}
    </ul>
  );
}

/** A frase da confirmação concorda com a contagem: nada com 0, singular com 1, plural com 2+. */
function ConfirmText({ summary, words }) {
  const n = summary.to_delete;
  if (!n) return "O que esta conciliação mudou no Fincla volta a ser como era antes.";
  if (n === 1) {
    return `A transação adicionada será apagada${summary.edited_after ? ", mesmo editada depois" : ""}. Para trazê-la de volta, será preciso ${words.reimport}.`;
  }
  return `As ${n.toLocaleString("pt-BR")} transações adicionadas serão apagadas${summary.edited_after ? ", inclusive as editadas depois" : ""}. Para trazê-las de volta, será preciso ${words.reimport}.`;
}

function ConfirmBox({ preview, words, touch, undoing, onConfirm, onCancel }) {
  const { summary } = preview;
  return (
    <div role="group" aria-label={`Confirmar desfazer ${words.noun}`} style={{ background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ ...G, fontSize: 13, color: T.ink, margin: 0 }}>
        <b>Tem certeza?</b> <ConfirmText summary={summary} words={words} />
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="red" onClick={onConfirm} disabled={undoing} style={touchHeight(touch)}>{undoing ? "Desfazendo…" : `Sim, desfazer ${words.noun}`}</Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={undoing} style={touchHeight(touch)}>Cancelar</Btn>
      </div>
    </div>
  );
}

/**
 * A tela do desfazer, sem o título: carrega a prévia (`loadPreview`, refeita quando `previewKey`
 * muda), mostra o que vai acontecer e desfaz (`runUndo`) só depois do "Sim" na página. Recusado
 * pelo servidor: o erro aparece e a prévia é buscada de novo (o estado pode ter mudado noutra aba).
 * `renderUndone(deleted)`: o fim (`deleted` = quantas o backend apagou; `null` = já estava desfeita).
 * Quem usa passa também `key={previewKey}`: a confirmação, o fim e o erro são de UMA conciliação, e
 * trocar de conciliação na mesma rota remonta a tela do zero.
 */
export function UndoPreviewScreen({ previewKey, loadPreview, runUndo, words = STATEMENT_UNDO_WORDS, touch = false, renderUndone, onBack, backLabel = "Voltar para a conciliação", onUndone = null }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [undone, setUndone] = useState(null);
  const load = useRef(loadPreview);
  load.current = loadPreview;
  // A nova busca da prévia depois de uma recusa pode voltar com a tela já fechada.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!previewKey) return undefined;
    let alive = true;
    setPreview(null);
    setLoadError("");
    load.current()
      .then((data) => { if (alive) setPreview(data); })
      .catch((err) => { if (alive) setLoadError(handleApiError(err)); });
    return () => { alive = false; };
  }, [previewKey]);

  const undo = async () => {
    setUndoing(true);
    setUndoError("");
    try {
      const result = await runUndo();
      if (!mounted.current) return;
      // O número que o backend apagou de fato, não o da prévia (que pode ter ficado velha).
      setUndone({ deleted: result.deleted_transactions });
      onUndone?.();
    } catch (err) {
      if (!mounted.current) return;
      setUndoError(handleApiError(err));
      setConfirming(false);
      // O estado pode ter mudado (outra conciliação concluída, outra aba): a prévia volta a valer.
      load.current()
        .then((data) => { if (mounted.current) setPreview(data); })
        .catch(() => {});
    } finally {
      if (mounted.current) setUndoing(false);
    }
  };

  if (undone) return renderUndone(undone.deleted);
  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;
  if (!preview) return <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando o que o desfazer vai fazer…</p>;
  if (preview.refusal?.code === "already_undone") return renderUndone(null);

  const listed = preview.transactions_to_delete;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {preview.refusal ? (
        <div data-testid="undo-refusal" data-code={preview.refusal.code} role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={T.amber} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>Não dá para desfazer esta {words.noun}.</b> {preview.refusal.message}</span>
        </div>
      ) : null}
      {preview.refusal?.code !== "not_concluded" ? (
        <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <b style={{ ...G, fontSize: 14, color: T.ink }}>
            {preview.can_undo ? `Se você desfizer esta ${words.noun}:` : `O que esta ${words.noun} fez:`}
          </b>
          <WhatHappens preview={preview} words={words} />
          {listed.length ? (
            <ul aria-label="Transações que serão apagadas" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {listed.map((t) => <DeletedTransactionRow key={t.transaction_id} transaction={t} />)}
            </ul>
          ) : null}
          {preview.to_restore.length ? (
            <ul aria-label="O que volta ao estado de antes" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {preview.to_restore.map((r) => (r.entity_type === "invoice" && r.invoice
                ? <RestoredInvoiceRow key={`${r.entity_type}-${r.entity_id}`} entity={r} />
                : <RestoredTransactionRow key={`${r.entity_type}-${r.entity_id}`} entity={r} />))}
            </ul>
          ) : null}
        </Card>
      ) : null}
      <ErrorNote>{undoError}</ErrorNote>
      {preview.can_undo && confirming ? (
        <ConfirmBox preview={preview} words={words} touch={touch} undoing={undoing} onConfirm={undo} onCancel={() => setConfirming(false)} />
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {preview.can_undo && !confirming ? (
          <Btn variant="outRed" onClick={() => { setUndoError(""); setConfirming(true); }} style={touchHeight(touch)}>
            <Undo2 size={14} aria-hidden="true" style={{ marginRight: 6 }} />
            Desfazer {words.noun}
          </Btn>
        ) : null}
        <Btn variant="ghost" onClick={onBack} style={touchHeight(touch)}>{backLabel}</Btn>
      </div>
    </div>
  );
}
