// Desfazer importação (Conciliar extrato, fincla-api#509).
//
// `/accounts/$accountId/reconcile/$importId/undo`: tela própria que primeiro mostra o que vai
// acontecer (a prévia vem pronta do backend: a tela não recalcula nada) e só desfaz depois de
// a pessoa confirmar AQUI, na página (nunca `window.confirm`). Quando não dá para desfazer, o
// backend diz o motivo e a tela mostra o motivo no lugar do botão.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { AlertTriangle, Undo2 } from "lucide-react";

import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Badge, Btn, Card, PageTitle } from "../components/primitives";
import { plural } from "../plural.js";
import { formatMoney } from "../money/formatMoney.js";
import { handleApiError } from "../../api/client";
import { listAccounts } from "../../api/accounts";
import { previewStatementImportUndo, undoStatementImport } from "../../api/statementImports";
import { bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";
import { ErrorNote, ImportUndoneCard } from "../features/statementImport/StatementImportNotes.jsx";
import { statementReconciliationPath } from "../routing/statementImportRoute.js";

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
};

const TEXT = { ...G, fontSize: 13, color: T.inkMid, margin: 0 };

const fieldList = (fields) => fields.map((f) => CHANGED_FIELD_LABEL[f] ?? f).join(", ");

function useAccountName(organizationId, accountId) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (!organizationId || !accountId) return undefined;
    let alive = true;
    listAccounts(organizationId)
      .then((accounts) => { if (alive) setName(accounts.find((a) => a.id === accountId)?.name ?? ""); })
      .catch(() => {});
    return () => { alive = false; };
  }, [organizationId, accountId]);
  return name;
}

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
      {entity.kept_fields?.length ? (
        <span data-testid="undo-kept" style={{ fontSize: 12, color: T.inkMid }}>
          Você mudou de novo depois: fica como você deixou ({fieldList(entity.kept_fields)}).
        </span>
      ) : null}
    </li>
  );
}

function WhatHappens({ preview }) {
  const { summary } = preview;
  return (
    <ul style={{ ...G, fontSize: 14, color: T.ink, margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      <li data-testid="undo-delete-count">
        <b style={NUM}>{plural(summary.to_delete, "transação adicionada", "transações adicionadas")}</b>{" "}
        {summary.to_delete === 1 ? "será apagada" : "serão apagadas"}
        {summary.edited_after ? (
          <span style={{ color: T.amber }}>
            {" "}({plural(summary.edited_after, "editada", "editadas")} depois da conciliação — {summary.edited_after === 1 ? "essa também some" : "essas também somem"})
          </span>
        ) : null}
      </li>
      {summary.to_restore ? (
        <li data-testid="undo-restore-count">
          <b style={NUM}>{plural(summary.to_restore, "transação que já estava", "transações que já estavam")}</b> no Fincla{" "}
          {summary.to_restore === 1 ? "volta" : "voltam"} ao estado de antes da conciliação
        </li>
      ) : null}
      {summary.already_deleted ? (
        <li data-testid="undo-already-deleted" style={{ color: T.inkMid }}>
          {plural(summary.already_deleted, "transação da conciliação já foi excluída", "transações da conciliação já foram excluídas")} por você: nada a fazer com {summary.already_deleted === 1 ? "ela" : "elas"}
        </li>
      ) : null}
    </ul>
  );
}

function ConfirmBox({ preview, undoing, onConfirm, onCancel }) {
  const { summary } = preview;
  return (
    <div role="group" aria-label="Confirmar desfazer importação" style={{ background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ ...G, fontSize: 13, color: T.ink, margin: 0 }}>
        <b>Tem certeza?</b> {summary.to_delete === 1 ? "A transação adicionada será apagada" : `As ${summary.to_delete} transações adicionadas serão apagadas`}
        {summary.edited_after ? ", inclusive as editadas depois" : ""}. Para trazê-las de volta, será preciso importar o extrato de novo.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="red" onClick={onConfirm} disabled={undoing}>{undoing ? "Desfazendo…" : "Sim, desfazer importação"}</Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={undoing}>Cancelar</Btn>
      </div>
    </div>
  );
}

function UndoneView({ deleted, accountName, onOpenTransactions, onBack }) {
  return (
    <ImportUndoneCard onOpenTransactions={onOpenTransactions} onBack={onBack}>
      {deleted == null
        ? "As transações que esta importação adicionou foram apagadas."
        : <>{plural(deleted, "transação adicionada foi apagada", "transações adicionadas foram apagadas")}.</>}
      {accountName ? <> A conta <b>{accountName}</b> voltou ao que era antes da conciliação.</> : null}
    </ImportUndoneCard>
  );
}

export function StatementImportUndoPage({ organizationId, onOpenAccountTransactions = null, onUndone = null }) {
  const { accountId, importId } = useParams({ strict: false });
  const navigate = useNavigate();
  const accountName = useAccountName(organizationId, accountId);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [undone, setUndone] = useState(null);
  // A nova busca da prévia depois de uma recusa pode voltar com a tela já fechada.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!organizationId || !accountId || !importId) return undefined;
    let alive = true;
    previewStatementImportUndo(accountId, organizationId, importId)
      .then((data) => { if (alive) setPreview(data); })
      .catch((err) => { if (alive) setLoadError(handleApiError(err)); });
    return () => { alive = false; };
  }, [organizationId, accountId, importId]);

  if (!organizationId || !accountId || !importId) return null;

  const back = () => navigate({ to: "/accounts" });
  const openTransactions = onOpenAccountTransactions ? () => onOpenAccountTransactions(accountId) : null;

  const undo = async () => {
    setUndoing(true);
    setUndoError("");
    try {
      const result = await undoStatementImport(accountId, organizationId, importId);
      if (!mounted.current) return;
      // O número que o backend apagou de fato, não o da prévia (que pode ter ficado velha).
      setUndone({ deleted: result.deleted_transactions });
      onUndone?.();
    } catch (err) {
      if (!mounted.current) return;
      setUndoError(handleApiError(err));
      setConfirming(false);
      // O estado pode ter mudado (outra importação concluída, outra aba): a prévia volta a valer.
      previewStatementImportUndo(accountId, organizationId, importId)
        .then((data) => { if (mounted.current) setPreview(data); })
        .catch(() => {});
    } finally {
      if (mounted.current) setUndoing(false);
    }
  };

  let body;
  if (undone) {
    body = <UndoneView deleted={undone.deleted} accountName={accountName} onOpenTransactions={openTransactions} onBack={back} />;
  } else if (loadError) {
    body = <ErrorNote>{loadError}</ErrorNote>;
  } else if (!preview) {
    body = <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando o que o desfazer vai fazer…</p>;
  } else if (preview.refusal?.code === "already_undone") {
    body = <UndoneView deleted={null} accountName={accountName} onOpenTransactions={openTransactions} onBack={back} />;
  } else {
    const listed = preview.transactions_to_delete;
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {preview.refusal ? (
          <div data-testid="undo-refusal" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={16} color={T.amber} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span><b>Não dá para desfazer esta importação.</b> {preview.refusal.message}</span>
          </div>
        ) : null}
        {preview.refusal?.code !== "not_concluded" ? (
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <b style={{ ...G, fontSize: 14, color: T.ink }}>
              {preview.can_undo ? "Se você desfizer esta importação:" : "O que esta importação fez:"}
            </b>
            <WhatHappens preview={preview} />
            {listed.length ? (
              <ul aria-label="Transações que serão apagadas" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {listed.map((t) => <DeletedTransactionRow key={t.transaction_id} transaction={t} />)}
              </ul>
            ) : null}
            {preview.to_restore.length ? (
              <ul aria-label="Transações que voltam ao estado de antes" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {preview.to_restore.map((r) => <RestoredTransactionRow key={`${r.entity_type}-${r.entity_id}`} entity={r} />)}
              </ul>
            ) : null}
          </Card>
        ) : null}
        <ErrorNote>{undoError}</ErrorNote>
        {preview.can_undo && confirming ? (
          <ConfirmBox preview={preview} undoing={undoing} onConfirm={undo} onCancel={() => setConfirming(false)} />
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {preview.can_undo && !confirming ? (
            <Btn variant="outRed" onClick={() => { setUndoError(""); setConfirming(true); }}>
              <Undo2 size={14} aria-hidden="true" style={{ marginRight: 6 }} />
              Desfazer importação
            </Btn>
          ) : null}
          <Btn variant="ghost" onClick={() => navigate({ to: statementReconciliationPath(accountId, importId) })}>Voltar para a conciliação</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div>
        <PageTitle sans="Desfazer" serif="importação" />
        <p style={{ ...TEXT, marginTop: 6 }}>
          {accountName ? <><b>{accountName}</b> · </> : null}
          Só a importação concluída mais recente da conta pode ser desfeita. Nada muda até você confirmar.
        </p>
      </div>
      {body}
    </div>
  );
}
