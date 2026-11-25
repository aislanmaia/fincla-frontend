// Desfazer importação (Conciliar extrato, fincla-api#509).
//
// `/accounts/$accountId/reconcile/$importId/undo`: tela própria que primeiro mostra o que vai
// acontecer e só desfaz depois de a pessoa confirmar AQUI, na página. A prévia, a confirmação e a
// recusa são as de `UndoPreviewScreen`, comuns ao desfazer da fatura do cartão (fincla-api#556).
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { plural } from "../plural.js";
import { listAccounts } from "../../api/accounts";
import { previewStatementImportUndo, undoStatementImport } from "../../api/statementImports";
import { ImportUndoneCard } from "../features/statementImport/StatementImportNotes.jsx";
import { STATEMENT_UNDO_WORDS, UndoPreviewScreen } from "../features/statementImport/UndoPreviewScreen.jsx";
import { statementReconciliationPath } from "../routing/statementImportRoute.js";

export { CHANGED_FIELD_LABEL } from "../features/statementImport/UndoPreviewScreen.jsx";

const TEXT = { ...G, fontSize: 13, color: T.inkMid, margin: 0 };

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

function UndoneView({ deleted, accountName, onOpenTransactions, onBack }) {
  return (
    <ImportUndoneCard onOpenTransactions={onOpenTransactions} onBack={onBack}>
      {deleted == null
        ? "As transações que esta importação adicionou foram apagadas. "
        : deleted ? <>{plural(deleted, "transação adicionada foi apagada", "transações adicionadas foram apagadas")}. </> : null}
      {accountName ? <>A conta <b>{accountName}</b> voltou ao que era antes da conciliação.</> : "A conciliação foi desfeita."}
    </ImportUndoneCard>
  );
}

export function StatementImportUndoPage({ organizationId, isMobile = false, onOpenAccountTransactions = null, onUndone = null }) {
  const { accountId, importId } = useParams({ strict: false });
  const navigate = useNavigate();
  const accountName = useAccountName(organizationId, accountId);

  if (!organizationId || !accountId || !importId) return null;

  const back = () => navigate({ to: "/accounts" });
  const openTransactions = onOpenAccountTransactions ? () => onOpenAccountTransactions(accountId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div>
        <PageTitle sans="Desfazer" serif="importação" />
        <p style={{ ...TEXT, marginTop: 6 }}>
          {accountName ? <><b>{accountName}</b> · </> : null}
          Só a importação concluída mais recente da conta pode ser desfeita. Nada muda até você confirmar.
        </p>
      </div>
      <UndoPreviewScreen
        previewKey={`${organizationId}|${accountId}|${importId}`}
        loadPreview={() => previewStatementImportUndo(accountId, organizationId, importId)}
        runUndo={() => undoStatementImport(accountId, organizationId, importId)}
        words={STATEMENT_UNDO_WORDS}
        touch={isMobile}
        onUndone={onUndone}
        onBack={() => navigate({ to: statementReconciliationPath(accountId, importId) })}
        renderUndone={(deleted) => <UndoneView deleted={deleted} accountName={accountName} onOpenTransactions={openTransactions} onBack={back} />}
      />
    </div>
  );
}
