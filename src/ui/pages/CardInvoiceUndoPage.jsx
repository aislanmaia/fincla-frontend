// Desfazer conciliação da fatura (fincla-api#556).
//
// `/cards/$cardId/reconcile/$importId/undo`: a mesma tela do desfazer do extrato (#509), com as
// palavras da fatura. Só a concluída mais recente do cartão pode ser desfeita; depois que a fatura é
// paga, o desfazer é recusado com o motivo (decisão 8). A prévia vem pronta do backend: "Editada
// depois", o que fica como a pessoa deixou e o valor que volta. Nada muda até o "Sim" na página.
import { useNavigate, useParams } from "@tanstack/react-router";

import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { plural } from "../plural.js";
import { previewCardInvoiceImportUndo, undoCardInvoiceImport } from "../../api/cardInvoiceImports";
import { ErrorNote, ImportUndoneCard } from "../features/statementImport/StatementImportNotes.jsx";
import { INVOICE_UNDO_WORDS, UndoPreviewScreen } from "../features/statementImport/UndoPreviewScreen.jsx";
import { cardName, useCardOf } from "../features/statementImport/useCardOf.js";
import { cardInvoiceReconciliationPath } from "../routing/cardInvoiceImportRoute.js";

function UndoneView({ deleted, name, touch, onBack, onNewUpload }) {
  return (
    <ImportUndoneCard title="Conciliação desfeita" openLabel="Conciliar a fatura de novo" backLabel="Voltar para os cartões" onOpenTransactions={onNewUpload} onBack={onBack} touch={touch}>
      {deleted ? <>{plural(deleted, "transação adicionada foi apagada", "transações adicionadas foram apagadas")}. </> : null}
      As compras que esta conciliação tinha conferido {name ? <>no <b>{name}</b> </> : null}voltaram ao que eram antes: o valor de antes e sem a marca de conferida.
    </ImportUndoneCard>
  );
}

export function CardInvoiceUndoPage({ organizationId, isMobile = false, onUndone = null }) {
  const { cardId: cardPublicId, importId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { card, error, loaded } = useCardOf(organizationId, cardPublicId);
  if (!organizationId || !cardPublicId || !importId) return null;

  let body;
  if (error) body = <ErrorNote>{error}</ErrorNote>;
  else if (!loaded) body = <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando o cartão…</p>;
  else if (!card) body = <ErrorNote>Cartão não encontrado ou sem acesso.</ErrorNote>;
  else {
    // `key`: outra conciliação na mesma rota começa do zero (sem confirmação aberta, fim ou erro da anterior).
    const previewKey = `${organizationId}|${card.id}|${importId}`;
    body = (
      <UndoPreviewScreen
        key={previewKey}
        previewKey={previewKey}
        loadPreview={() => previewCardInvoiceImportUndo(card.id, organizationId, importId)}
        runUndo={() => undoCardInvoiceImport(card.id, organizationId, importId)}
        words={INVOICE_UNDO_WORDS}
        touch={isMobile}
        onUndone={onUndone}
        onBack={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId, importId) })}
        renderUndone={(deleted) => (
          <UndoneView
            deleted={deleted}
            name={cardName(card)}
            touch={isMobile}
            onBack={() => navigate({ to: "/cards" })}
            onNewUpload={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId) })}
          />
        )}
      />
    );
  }

  return (
    <div data-testid="card-invoice-undo-page" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div>
        <PageTitle sans="Desfazer" serif="conciliação" />
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>
          {card ? <><b>{cardName(card)}</b> · </> : null}
          Só a conciliação de fatura concluída mais recente do cartão pode ser desfeita, e só enquanto a fatura não foi paga. Nada muda até você confirmar.
        </p>
      </div>
      {body}
    </div>
  );
}
