// Conciliar fatura do cartão (fincla-api#554; primeira entrega #555, segunda #556, terceira #557,
// quarta #558, quinta #559).
//
// #559: os passos 2 "Compras em outra fatura" e 3 "Decidir casos com dúvida" respondem
// (`InvoiceChoiceStep`). Na dúvida, clicar numa opção já responde ("Sim, é esta" nesta fatura; "Mover"
// na vizinha) e "Está no Fincla com outros dados…" abre a busca do extrato (`FinclaSearchDialog`)
// nas faturas vizinhas do cartão. Na outra fatura, a sugestão de mover vem marcada, com "Confirmar
// sugestão". Fatura paga (decisão 1): só ligar; mover e adicionar desligados com o motivo. Um
// rascunho cuja leitura não vale mais (`changed_since_read`) diz para descartar e reenviar, e o
// Concluir fica desligado com o motivo.
//
// #558: o passo 4 "Encargos, tarifas e estornos" responde. O grupo de encargos é UM item da fila
// (respondido pela rota do grupo: "Sim, somados em <transação>" · "Não, adicionar cada um" · "Não
// registrar"); anuidade, redução, repasse de IOF e estornos são "Adicionar" com o formulário do
// passo 5, e o crédito vira estorno. O "Próximo" confirma os lançamentos e o grupo num lote só (os
// lançamentos do grupo nunca vão nele: o grupo vai em `groups`).
//
// #557: o passo 5 "Compras novas" responde (Adicionar · Não registrar), com o formulário do item
// novo do extrato (o mesmo `NewEntriesStep`/`StatementEntryCard`, com a forma de pagamento travada
// no cartão e as opções da compra parcelada), e "Não, adicionar agora" do passo 1 abre o mesmo
// formulário. O resumo conta as transações novas e as sem categoria; compra nova sem descrição
// segura o Concluir, com o motivo.
//
// #556: a tela de envio mostra "Faturas conciliadas" do cartão (continuar/descartar rascunho,
// desfazer só na concluída mais recente); o rascunho retoma no passo em que parou; o mesmo PDF já
// conciliado só avisa, e os lançamentos já conferidos aparecem só para leitura; a concluída oferece
// "Desfazer conciliação" (tela própria, `CardInvoiceUndoPage`) quando dá, e diz o motivo quando não.
//
// `/cards/$cardId/reconcile` envia o PDF da fatura; `/cards/$cardId/reconcile/$importId` é o
// rascunho guiado pelos 8 passos. A URL usa o `public_id` do cartão; a API, o `id` inteiro. Nada
// muda no Fincla até "Concluir conciliação da fatura": cada resposta é gravada no rascunho, e as
// contagens, a diferença e os bloqueios vêm do backend.
//
// Mesmo molde da conciliação da conta (`StatementReconciliationPage`): a moldura (topo fixo, trilho,
// passo vazio), a fila de lançamentos (`entryQueue`: só o atual aberto, recolher no clique sem
// temporizador, linha parada, rodapé "Falta responder N ↑/↓", atalhos S/N) e a área de envio.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { AlertTriangle, Check, CreditCard, Info, Undo2 } from "lucide-react";

import { T, TOUCH_TARGET } from "../tokens";
import { G, NUM } from "../typography";
import { Btn, Card, PageTitle, TouchTargets } from "../components/primitives";
import { plural } from "../plural.js";
import { formatMoney } from "../money/formatMoney.js";
import {
  concludeCardInvoiceImport,
  confirmCardInvoiceSuggestions,
  discardCardInvoiceImport,
  getCardInvoiceImport,
  invoiceDraftInProgressOf,
  listCardInvoiceImports,
  previewCardInvoiceImportUndo,
  searchCardInvoiceEntry,
  updateCardInvoiceChargeGroup,
  updateCardInvoiceEntries,
  updateCardInvoiceEntry,
  updateCardInvoiceImportProgress,
  uploadCardInvoice,
} from "../../api/cardInvoiceImports";
import { cardInvoiceReconciliationPath, cardInvoiceUndoPath } from "../routing/cardInvoiceImportRoute.js";
import { invoiceDashboardPath } from "../routing/invoiceRoute.js";
import { EmptyStep, RAIL_WIDTH, StepRail, StickyTop } from "../features/statementImport/ReconciliationFrame.jsx";
import { ErrorNote } from "../features/statementImport/StatementImportNotes.jsx";
import { DiscardDraftControl, dayOf } from "../features/statementImport/ImportedStatements.jsx";
import { ReconciledInvoicesList } from "../features/statementImport/ReconciledInvoices.jsx";
import { ROW_GAP, UPLOAD_BASIS } from "../features/statementImport/startRowLayout.js";
import { touchHeight } from "../features/statementImport/UndoPreviewScreen.jsx";
import { cardApiError, cardName, useCardOf } from "../features/statementImport/useCardOf.js";
import { StatementDropZone, usePreventFileDropOutside } from "../features/statementImport/StatementDropZone.jsx";
import { bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";
import { GoToPendingButton, reuseUnchangedEntries, useEntryQueue, useQueueShortcuts } from "../features/statementImport/entryQueue.jsx";
import {
  INVOICE_ENTRY_STEPS,
  INVOICE_RAIL_SEPARATOR,
  INVOICE_STEPS,
  answerableEntries,
  firstInvoiceStepWithWork,
  invoiceMonthLabel,
  invoiceMonthName,
  invoiceStepItems,
  invoiceStepProgress,
  invoiceStepStatus,
  isChargeGroupItem,
  invoiceSummaryRows,
  isInvoiceEntryAnswered,
  linksTransaction,
  pendingEntries,
  reconciledEntries,
  stepRemaining,
  unconfirmedEntries,
} from "../features/statementImport/invoiceSteps.js";
import {
  InvoiceSuggestedStep, PURCHASE_NOUN, ReadOnlyEntries, ReconciledEntries, invoiceAnswerUnavailable,
} from "../features/statementImport/InvoiceSuggestedStep.jsx";
import { InvoiceNewStep } from "../features/statementImport/InvoiceNewStep.jsx";
import { CHARGE_NOUN, InvoiceChargesStep, chargeGroupAnswerUnavailable } from "../features/statementImport/InvoiceChargesStep.jsx";
import { useCategories } from "../features/statementImport/useCategories.js";
import { FinclaSearchDialog } from "../features/statementImport/FinclaSearchDialog.jsx";
import {
  INVOICE_SEARCH_COPY, InvoiceChoiceStep, InvoiceSearchResult, invoiceSearchAmount, otherInvoiceAnswerUnavailable, pickAnswerOf, pickRefusal, takenByOf,
} from "../features/statementImport/InvoiceDoubtStep.jsx";

const NOTHING_CHANGES = "Nada muda no Fincla até você concluir a conciliação da fatura.";

/** Os passos que esta versão responde numa fila (só o atual aberto). */
const QUEUE_STEPS = new Set(["suggested", "other_invoice", "doubt", "charges", "new"]);

/** Os passos 2 e 3 (#559): a mesma lista de escolha (`InvoiceChoiceStep`). */
const CHOICE_STEPS = new Set(["other_invoice", "doubt"]);

/** dd/mm/aaaa de "YYYY-MM-DD", sem passar por `Date`. */
const fullDate = (ymd) => (ymd ? bankDateLabel(ymd) : "—");

// --------------------------------------------------------------------------------------------
// Enviar a fatura
// --------------------------------------------------------------------------------------------

/** "Você já tem uma conciliação em andamento desta fatura": só dá para continuar nela. */
function DraftInProgressNotice({ inProgress, touch, onContinue }) {
  return (
    <div data-testid="draft-in-progress-notice" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>{inProgress.message || "Você já tem uma conciliação em andamento desta fatura."}</b>{" "}
        Suas respostas estão salvas nela. Para recomeçar do zero, descarte o rascunho em “Faturas conciliadas”.
      </span>
      <div>
        <Btn variant="outGray" small={!touch} onClick={onContinue} style={touchHeight(touch)}>Continuar conciliação</Btn>
      </div>
    </div>
  );
}

/**
 * A tela do cartão: a área de envio do PDF (envia ao escolher, como a do extrato) e, ao lado,
 * "Faturas conciliadas" do cartão (fincla-api#556). O PDF de uma fatura com rascunho aberto leva a
 * "Continuar conciliação"; a lista é buscada de novo para o rascunho aparecer nela.
 */
function InvoiceUploadView({ organizationId, card, cardPublicId, isMobile }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [inProgress, setInProgress] = useState(null);
  const [items, setItems] = useState(null);
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  usePreventFileDropOutside();

  // A lista e o erro andam juntos: a busca que dá certo apaga o erro; a que falha tira a lista
  // velha (um rascunho já descartado não pode continuar na tela ao lado do erro).
  const load = useCallback(async () => {
    try {
      const data = await listCardInvoiceImports(card.id, organizationId);
      setItems(data);
      setListError("");
    } catch (err) {
      setItems(null);
      setListError(cardApiError(err));
    }
  }, [card.id, organizationId]);
  useEffect(() => { load(); }, [load]);

  const send = async (chosen) => {
    setFile(chosen);
    setSending(true);
    setError("");
    setNotice("");
    setInProgress(null);
    try {
      const draft = await uploadCardInvoice(card.id, organizationId, chosen);
      navigate({ to: cardInvoiceReconciliationPath(draft.credit_card.public_id ?? cardPublicId, draft.id) });
    } catch (err) {
      const running = invoiceDraftInProgressOf(err);
      if (running) {
        setInProgress(running);
        load();
      } else setError(cardApiError(err));
      setSending(false);
    }
  };

  const openImport = (item) => navigate({ to: cardInvoiceReconciliationPath(cardPublicId, item.id) });
  const drafts = (items ?? []).filter((i) => i.status === "draft");

  return (
    <div data-testid="card-invoice-upload" style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
          <PageTitle sans="Conciliar" serif="fatura" />
          <span style={{ ...G, fontSize: 13, color: T.inkMid }}>{cardName(card)}</span>
        </div>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0, maxWidth: 680 }}>
          Envie o PDF da fatura do Itaú. O Fincla reconhece o cartão pelo final e a fatura pelo vencimento, e mostra cada lançamento antes de qualquer coisa mudar.
        </p>
      </div>
      {notice ? <p role="status" style={{ ...G, fontSize: 13, color: T.green, margin: 0 }}>{notice}</p> : null}
      <div data-testid="start-upload-row" style={{ display: "flex", flexWrap: "wrap", gap: ROW_GAP, alignItems: "stretch", minHeight: 0 }}>
        {/* A área só aparece depois da lista (como a do extrato, G4 OBS-12): o tamanho depende de
            haver rascunho, e nascer grande para encolher em seguida faz a tela pular. Lista com erro:
            aparece mesmo assim. */}
        {items || listError ? (
          <div style={{ flex: `999 1 ${UPLOAD_BASIS}px`, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <StatementDropZone kind="invoice" compact={drafts.length > 0} touch={isMobile} readingName={sending && file ? file.name : ""} onFile={send} onError={setError} />
            <ErrorNote>{error}</ErrorNote>
            {inProgress ? (
              <DraftInProgressNotice
                inProgress={inProgress}
                touch={isMobile}
                onContinue={() => navigate({ to: cardInvoiceReconciliationPath(inProgress.creditCardPublicId ?? cardPublicId, inProgress.importId) })}
              />
            ) : null}
          </div>
        ) : null}
        {listError ? <div style={{ flex: "1 1 300px", minWidth: 0 }}><ErrorNote>{listError}</ErrorNote></div> : null}
        {items ? (
          <ReconciledInvoicesList
            items={items}
            organizationId={organizationId}
            isMobile={isMobile}
            discard={(item) => discardCardInvoiceImport(card.id, organizationId, item.id)}
            onOpen={openImport}
            onUndo={(item) => navigate({ to: cardInvoiceUndoPath(cardPublicId, item.id) })}
            onDiscarded={() => {
              setNotice("Rascunho descartado. Nada mudou nas suas transações.");
              setInProgress(null);
              load();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Topo
// --------------------------------------------------------------------------------------------

const CHIP = { ...G, fontSize: 12, color: T.inkMid, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9999, padding: "4px 10px", display: "inline-flex", gap: 6, alignItems: "center" };

/** `touch` (celular): os links ganham a altura de um alvo de toque; o texto fica do mesmo tamanho. */
function Breadcrumb({ invoiceImport, touch = false, onCards, onInvoice }) {
  const link = {
    ...G, background: "none", border: 0, padding: 0, fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer",
    ...(touch ? { minHeight: TOUCH_TARGET, display: "inline-flex", alignItems: "center" } : null),
  };
  const sep = <span aria-hidden="true" style={{ color: T.inkFaint }}>›</span>;
  return (
    <nav aria-label="Caminho" style={{ ...G, fontSize: 12, color: T.inkMid, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" style={link} onClick={onCards}>Cartões</button>{sep}
      <span>{invoiceImport.credit_card.name}</span>{sep}
      <button type="button" style={link} onClick={onInvoice}>Fatura de {invoiceMonthName(invoiceImport.invoice.month)}</button>{sep}
      <span aria-current="page">Conciliar fatura</span>
    </nav>
  );
}

function ContextChips({ invoiceImport }) {
  const { credit_card: card, invoice, entries, file_name: fileName } = invoiceImport;
  return (
    <div data-testid="invoice-chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span style={CHIP}><CreditCard size={13} aria-hidden="true" />Cartão <b style={{ color: T.ink }}>{card.name}</b></span>
      <span style={CHIP}>Fatura <b style={{ color: T.ink }}>{invoiceMonthLabel(invoice)}</b></span>
      <span style={CHIP}>
        Vencimento <b style={{ ...NUM, color: T.ink }}>{fullDate(invoice.due_date)}</b> · fechamento <b style={{ ...NUM, color: T.ink }}>{fullDate(invoice.closing_date)}</b>
      </span>
      <span data-testid="invoice-file-chip" style={CHIP}>
        {fileName ? <>Arquivo <b style={{ color: T.ink, overflowWrap: "anywhere" }}>{fileName}</b></> : "Arquivo lido do PDF"} · <span style={{ color: T.green, display: "inline-flex", gap: 4, alignItems: "center" }}>total conferido <Check size={12} aria-hidden="true" /></span></span>
      <span style={CHIP}><b style={{ ...NUM, color: T.ink }}>{entries.length.toLocaleString("pt-BR")}</b> {entries.length === 1 ? "lançamento" : "lançamentos"} na fatura</span>
    </div>
  );
}

/**
 * "Reconhecemos este arquivo como a fatura do <cartão> de <mês>…", com "escolha outro cartão". Com o
 * PDF de outro cartão (`other_card`) o final NÃO bate: só diz em que fatura o rascunho está, sem
 * afirmar o reconhecimento pelo final (o aviso de outro cartão logo abaixo diz de quem é o PDF).
 */
function RecognitionNotice({ invoiceImport, touch = false, onOtherCard }) {
  const { credit_card: card, invoice, card_check: cardCheck } = invoiceImport;
  const due = invoice.due_date ? invoice.due_date.slice(8, 10) + "/" + invoice.due_date.slice(5, 7) : null;
  const otherCard = cardCheck?.status === "other_card";
  const invoiceLabel = (
    <>
      <b>fatura do {card.name} de {invoiceMonthName(invoice.month)}</b>
      {due ? <> (vencimento <b style={NUM}>{due}</b>)</> : null}
    </>
  );
  return (
    <div data-testid="recognition-notice" role="note" style={{ ...G, fontSize: 13, color: T.ink, background: T.blueLight, border: `1px solid ${T.blue}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <Info size={14} aria-hidden="true" style={{ color: T.blue, flexShrink: 0, alignSelf: "center" }} />
      <span>
        {otherCard
          ? <>Esta conciliação está na {invoiceLabel}, pelo vencimento que vem no PDF. Se não for,{" "}</>
          : <>Reconhecemos este arquivo como a {invoiceLabel}, pelo final do cartão e pelo vencimento que vêm no PDF. Se não for,{" "}</>}
        {/* No celular o link tem a altura de um alvo de toque (QA F1), sem mudar a frase. */}
        <button type="button" onClick={onOtherCard} style={{ ...G, background: "none", border: 0, padding: 0, fontSize: 13, fontWeight: 600, color: T.blue, textDecoration: "underline", cursor: "pointer", ...(touch ? { display: "inline-flex", alignItems: "center", minHeight: TOUCH_TARGET, verticalAlign: "middle" } : null) }}>
          escolha outro cartão
        </button>.
      </span>
    </div>
  );
}

/** O PDF enviado pela tela de um cartão é de outro cartão da organização: só avisa (como a #515). */
function OtherCardNotice({ cardCheck, touch = false, onOpenCard }) {
  if (cardCheck?.status !== "other_card") return null;
  const suggested = cardCheck.suggested_card;
  return (
    <div data-testid="other-card-notice" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>Esta fatura parece ser de outro cartão.</b>{" "}
        {cardCheck.file_last4 ? <>O PDF é do cartão final <b style={NUM}>{cardCheck.file_last4}</b>{suggested ? <> ({suggested.name})</> : null}. </> : null}
        Se ela é mesmo deste cartão, pode seguir: nada impede a conciliação.
      </span>
      {suggested ? (
        <div>
          <Btn variant="outGray" small={!touch} onClick={() => onOpenCard(suggested)} style={touchHeight(touch)}>Conciliar no cartão {suggested.name}</Btn>
        </div>
      ) : null}
    </div>
  );
}

/**
 * O mesmo PDF já veio numa conciliação concluída deste cartão (fincla-api#556): só avisa. Os
 * lançamentos que ela conferiu aparecem como "já conferidos" e nada se duplica.
 */
function FileCheckNotice({ fileCheck, touch = false, onOpenPrevious }) {
  if (fileCheck?.status !== "already_imported") return null;
  const on = fileCheck.concluded_at ? dayOf(fileCheck.concluded_at) : "";
  return (
    <div data-testid="file-already-imported" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>Este arquivo já foi conciliado{on ? <> em <span style={NUM}>{on}</span></> : null}.</b>{" "}
        Os lançamentos que aquela conciliação conferiu aparecem como “já conferidos” no primeiro passo e nada se duplica.
      </span>
      {fileCheck.import_id ? (
        <div>
          <Btn variant="outGray" small={!touch} onClick={() => onOpenPrevious(fileCheck.import_id)} style={touchHeight(touch)}>Ver a conciliação anterior</Btn>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A leitura deste rascunho não vale mais (QA F4 OBS-01, `changed_since_read`): outra conciliação do
 * cartão foi concluída ou desfeita, ou a fatura foi paga ou desmarcada, depois que o PDF foi lido. O
 * rascunho não é recalculado: concluir é recusado. O caminho é descartar e enviar o PDF de novo.
 */
function StaleDraftNotice({ organizationId, importId, touch = false, discard, onDiscarded }) {
  return (
    <div data-testid="stale-draft-notice" role="alert" style={{ ...G, fontSize: 13, color: T.ink, background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <AlertTriangle size={14} aria-hidden="true" style={{ color: T.red, flexShrink: 0, alignSelf: "center" }} />
        <span>
          <b>Esta leitura ficou desatualizada: descarte e envie o PDF de novo.</b>{" "}
          Depois que o PDF foi lido, outra conciliação deste cartão foi concluída ou desfeita, ou o pagamento da fatura mudou. Esta conciliação não pode mais ser concluída; nada mudou nas suas transações.
        </span>
      </span>
      <div>
        <DiscardDraftControl organizationId={organizationId} importId={importId} discard={discard} onDiscarded={onDiscarded} touch={touch} label="Descartar e enviar o PDF de novo" />
      </div>
    </div>
  );
}

/** O motivo do Concluir desligado por uma leitura desatualizada. */
const STALE_REASON = "Esta leitura ficou desatualizada: descarte o rascunho e envie o PDF de novo.";

/** Banco − Fincla com sinal; zero em verde. `null` = não sabemos (nunca R$ 0,00). */
function signedDifference(value, currency) {
  if (value === null || value === undefined) return "não sabemos";
  if (Math.abs(value) < 0.005) return formatMoney(0, currency);
  return (value > 0 ? "+" : "−") + formatMoney(Math.abs(value), currency);
}

/** "Diferença da fatura agora" (banco − Fincla), fixa ao rolar, com "Banco R$ X · Fincla R$ Y". */
function InvoiceDifferencePanel({ differenceNow, compact = false }) {
  const { bank, fincla, difference, currency } = differenceNow;
  const known = difference !== null;
  const ok = known && Math.abs(difference) < 0.005;
  const tone = !known ? { border: T.border, bg: T.surface, ink: T.inkMid } : ok
    ? { border: T.greenBorder, bg: T.greenLight, ink: T.green }
    : { border: T.red, bg: T.redLight, ink: T.red };
  const state = !known ? "unknown" : ok ? "ok" : "off";
  const value = signedDifference(difference, currency);
  if (compact) {
    return (
      <div data-testid="invoice-difference" data-state={state} data-compact="true" role="status" aria-live="polite"
        style={{ ...G, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0, border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 12, padding: "8px 14px", boxShadow: T.sm }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkMid }}>Diferença agora</span>
        <span data-testid="invoice-difference-value" style={{ ...NUM, fontSize: 16, fontWeight: 800, color: tone.ink, whiteSpace: "nowrap" }}>{value}</span>
      </div>
    );
  }
  let sub;
  if (ok) sub = <>Banco e Fincla batem: <b style={NUM}>{formatMoney(bank, currency)}</b></>;
  else {
    sub = (
      <>
        Banco <b style={NUM}>{bank === null ? "não sabemos" : formatMoney(bank, currency)}</b> · Fincla{" "}
        <b style={NUM}>{fincla === null ? "não sabemos" : formatMoney(fincla, currency)}</b>
      </>
    );
  }
  return (
    <div data-testid="invoice-difference" data-state={state} role="status" aria-live="polite"
      style={{ ...G, minWidth: 0, flex: "1 1 240px", border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 14, padding: "12px 16px", boxShadow: T.sm }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkMid }}>Diferença da fatura agora</div>
      <div data-testid="invoice-difference-value" style={{ ...NUM, fontSize: 22, fontWeight: 800, color: tone.ink, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ProgressCard({ invoiceImport, passed }) {
  const { done, total } = invoiceStepProgress(invoiceImport, passed);
  return (
    <Card style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", flex: "3 1 320px", minWidth: 0 }}>
      <div role="status" data-testid="invoice-progress" style={{ ...G, fontSize: 12, color: T.inkMid }}>
        Seu progresso: <b style={NUM}>{done}</b> de <b style={NUM}>{total}</b> passos conferidos
        <div style={{ height: 4, background: T.grayLight, borderRadius: 99, marginTop: 6, width: 200, maxWidth: "100%" }}>
          <div style={{ height: 4, borderRadius: 99, background: T.green, width: `${(done / total) * 100}%`, transition: "width .3s" }} />
        </div>
      </div>
    </Card>
  );
}

/** O progresso e a diferença: no computador o topo inteiro gruda; no celular só a diferença, compacta. */
function ProgressPanel({ invoiceImport, passed, isMobile }) {
  if (isMobile) {
    return (
      <>
        <div data-testid="status-bar"><ProgressCard invoiceImport={invoiceImport} passed={passed} /></div>
        <StickyTop><InvoiceDifferencePanel differenceNow={invoiceImport.difference_now} compact /></StickyTop>
      </>
    );
  }
  return (
    <StickyTop>
      <div data-testid="status-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        <ProgressCard invoiceImport={invoiceImport} passed={passed} />
        <InvoiceDifferencePanel differenceNow={invoiceImport.difference_now} />
      </div>
    </StickyTop>
  );
}

// --------------------------------------------------------------------------------------------
// Passos
// --------------------------------------------------------------------------------------------

/** O que os passos que esta versão ainda não faz dizem, quando não têm lançamento. */
const EMPTY_TEXT = {
  suggested: "Nada a fazer aqui: o Fincla não achou compra desta fatura já lançada.",
  other_invoice: "Nada a fazer aqui: nenhuma compra desta fatura está em outra fatura no Fincla.",
  doubt: "Nada a fazer aqui: nenhum caso com dúvida nesta fatura.",
  charges: "Nada a fazer aqui: nenhum encargo, tarifa ou estorno sem par nesta fatura.",
  new: "Nada a fazer aqui: nenhuma compra nova nesta fatura.",
  leftover: "Nada a fazer aqui nesta versão: os itens do Fincla que o banco não cobrou ficam como estão.",
  total: "Nada a fazer aqui nesta versão: a diferença da fatura agora, no topo, já compara o banco com o Fincla.",
};

/**
 * Onde corrigir os "Adicionar" que pedem algo (descrição, categoria): o passo de cada um, pela
 * classificação ("Não, adicionar agora" do passo 1 e do passo 3 se corrigem lá; as compras novas em
 * "Compras novas"; anuidade, redução, repasse de IOF e estornos em "Encargos, tarifas e estornos").
 * Os lançamentos do grupo de encargos (#558) não têm onde: "Não, adicionar cada um" os cria como o
 * banco mandou, sem formulário (decisão do orquestrador, como no protótipo); `where` vem vazio quando
 * só eles estão na situação. E o substantivo: só compras → "compra nova"; com encargo, tarifa ou
 * estorno → "transação nova".
 */
function createsWhere(entries, test) {
  const creates = entries.filter((e) => e.answer === "create" && test(e));
  const onlyPurchases = creates.every((e) => e.classification !== "charges");
  const fixable = new Set(creates.filter((e) => !e.charge_group_id).map((e) => e.classification));
  const where = INVOICE_STEPS.filter((s) => fixable.has(s.key)).map((s) => s.title).join(" e em ");
  return {
    where,
    one: onlyPurchases ? "compra nova" : "transação nova",
    many: onlyPurchases ? "compras novas" : "transações novas",
  };
}

/**
 * "Falta responder 1 grupo de encargos e 2 itens": o `unanswered` do backend conta cada lançamento do
 * grupo; a tela chama o grupo pelo nome, como o trilho e o rodapé do passo.
 */
function unansweredText(invoiceImport) {
  const groups = (invoiceImport.charge_groups ?? []).filter((g) => g.answerable && g.answer === null);
  const inGroups = groups.reduce((n, g) => n + g.entry_ids.length, 0);
  const rest = Math.max(0, invoiceImport.summary.unanswered - inGroups);
  return [
    groups.length ? plural(groups.length, "grupo de encargos", "grupos de encargos") : null,
    rest ? plural(rest, "item", "itens") : null,
  ].filter(Boolean).join(" e ");
}

function SummaryStep({ invoiceImport, concluding, error, touch = false, onConclude }) {
  const rows = invoiceSummaryRows(invoiceImport);
  const { difference_now: now, invoice, summary } = invoiceImport;
  const pending = summary.unanswered;
  const missing = summary.missing_description;
  const blocked = !invoiceImport.can_conclude || invoiceImport.changed_since_read || pending > 0 || missing > 0;
  const blank = createsWhere(invoiceImport.entries, (e) => !String(e.description ?? "").trim());
  const uncategorized = createsWhere(invoiceImport.entries, (e) => !e.category_tag_id);
  const reasons = [
    invoiceImport.changed_since_read ? STALE_REASON : null,
    pending ? `Falta responder ${unansweredText(invoiceImport) || plural(pending, "item", "itens")}.` : null,
    missing ? `${missing === 1 ? `Uma ${blank.one} está` : `${missing.toLocaleString("pt-BR")} ${blank.many} estão`} sem descrição${blank.where ? `: escreva a descrição em ${blank.where}` : ""}.` : null,
  ].filter(Boolean);
  const why = reasons.length ? reasons.join(" ") : invoiceImport.blockers.length ? "Ainda há pendências na conciliação." : "";
  const off = now.difference !== null && Math.abs(now.difference) >= 0.005;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <div data-testid="invoice-summary-rows" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <div key={row.testId} data-testid={row.testId} style={{ ...G, fontSize: 13, color: T.inkMid, display: "flex", gap: 10, alignItems: "baseline" }}>
              <b style={{ ...NUM, fontSize: 15, color: T.ink, minWidth: 28, textAlign: "right" }}>{row.count.toLocaleString("pt-BR")}</b>{" "}
              <span>{row.text}{row.note ? <span style={{ fontSize: 12, color: T.inkLight }}> · {row.note}</span> : null}</span>
            </div>
          ))}
          {!rows.length ? <span style={{ ...G, fontSize: 13, color: T.inkMid }}>Nenhuma mudança no Fincla.</span> : null}
        </div>
      </Card>
      {summary.uncategorized ? (
        <div role="note" data-testid="summary-uncategorized" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "baseline" }}>
          <AlertTriangle size={14} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, alignSelf: "center" }} />
          <span>
            {summary.uncategorized === 1 ? `Uma ${uncategorized.one} está sem categoria e vai` : `${summary.uncategorized.toLocaleString("pt-BR")} ${uncategorized.many} estão sem categoria e vão`} para <b>Não classificado</b> ao concluir.{uncategorized.where ? ` Dá para escolher a categoria em ${uncategorized.where}.` : null}
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Card data-testid="summary-fincla-total" style={{ padding: "12px 16px", flex: "1 1 220px" }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Fatura de {invoiceMonthName(invoice.month)} no Fincla fica</div>
          <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: T.ink }}>{now.fincla === null ? "não sabemos" : formatMoney(now.fincla, now.currency)}</div>
        </Card>
        <Card data-testid="summary-difference" style={{ padding: "12px 16px", flex: "1 1 220px", ...(off ? { background: T.redLight, borderColor: T.red } : null) }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Diferença que fica registrada</div>
          <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: off ? T.red : T.green }}>{signedDifference(now.difference, now.currency)}</div>
        </Card>
      </div>
      <div role="note" data-testid="payment-not-marked" style={{ ...G, fontSize: 13, color: T.ink, background: T.blueLight, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "baseline" }}>
        <Info size={14} aria-hidden="true" style={{ color: T.blue, flexShrink: 0, alignSelf: "center" }} />
        <span>O <b>pagamento</b> desta fatura não é marcado aqui: ele é conferido quando você concilia o extrato da conta corrente, no passo “Conferir pagamento de fatura”.</span>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Btn variant="dark" onClick={onConclude} disabled={blocked || concluding} aria-describedby={why ? "conclude-blocked" : undefined} style={touchHeight(touch)}>
          {concluding ? "Concluindo…" : "Concluir conciliação da fatura"}
        </Btn>
        {why ? <span id="conclude-blocked" data-testid="conclude-blocked" style={{ ...G, fontSize: 12, color: T.amber }}>{why}</span> : null}
      </div>
    </div>
  );
}

/**
 * O que a concluída diz sobre desfazer: só a mais recente do cartão pode, e só enquanto a fatura não
 * foi paga (decisão 8). A prévia do backend decide: `can_undo` mostra o botão, a recusa mostra o
 * motivo. Sem conseguir ler a prévia, o botão aparece e a tela do desfazer explica.
 */
function useUndoAvailability(cardId, organizationId, invoiceImport) {
  const [state, setState] = useState({ checked: false, canUndo: false, refusal: null });
  const latest = invoiceImport.latest_concluded;
  useEffect(() => {
    if (!latest) return undefined;
    let alive = true;
    previewCardInvoiceImportUndo(cardId, organizationId, invoiceImport.id)
      .then((preview) => { if (alive) setState({ checked: true, canUndo: preview.can_undo, refusal: preview.refusal }); })
      .catch(() => { if (alive) setState({ checked: true, canUndo: true, refusal: null }); });
    return () => { alive = false; };
  }, [cardId, organizationId, invoiceImport.id, latest]);
  if (!latest) {
    return { checked: true, canUndo: false, refusal: { code: "not_latest", message: "Só a conciliação de fatura concluída mais recente deste cartão pode ser desfeita." } };
  }
  return state;
}

function DoneView({ invoiceImport, cardId, organizationId, touch, onOpenInvoice, onUndo }) {
  const { invoice, final_difference: recorded } = invoiceImport;
  const undo = useUndoAvailability(cardId, organizationId, invoiceImport);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="fatura" />
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.green, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Check size={18} aria-hidden="true" /> Fatura de {invoiceMonthName(invoice.month)} conciliada
        </h2>
        <p data-testid="done-totals" style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
          Fatura no Fincla: <b style={NUM}>{invoice.total ? formatMoney(invoice.total.amount, invoice.total.currency) : "não sabemos"}</b> · diferença registrada:{" "}
          <b style={NUM}>{recorded ? signedDifference(recorded.amount, recorded.currency) : "não registrada"}</b>.
        </p>
        <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>
          O pagamento da fatura não mudou: ele é conferido na conciliação do extrato da conta corrente.
        </p>
        {undo.refusal ? (
          <p data-testid="undo-unavailable" data-code={undo.refusal.code} role="note" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, display: "flex", gap: 6, alignItems: "baseline" }}>
            <AlertTriangle size={13} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, alignSelf: "center" }} />
            <span>Não dá para desfazer esta conciliação. {undo.refusal.message}</span>
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="dark" onClick={onOpenInvoice} style={touchHeight(touch)}>Ver a fatura</Btn>
          {undo.checked && undo.canUndo ? (
            <Btn variant="outRed" onClick={onUndo} style={touchHeight(touch)}>
              <Undo2 size={14} aria-hidden="true" style={{ marginRight: 6 }} />
              Desfazer conciliação
            </Btn>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** A conciliação desfeita (#556): o Fincla voltou ao que era; a fatura aceita um PDF de novo. */
function UndoneInvoiceView({ invoiceImport, touch, onOpenInvoice, onNewUpload }) {
  const { invoice, undone_at: undoneAt } = invoiceImport;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="fatura" />
      <Card data-testid="invoice-import-undone" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Undo2 size={18} aria-hidden="true" /> Conciliação da fatura de {invoiceMonthName(invoice.month)} desfeita
        </h2>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
          {undoneAt ? <>Desfeita em <b style={NUM}>{dayOf(undoneAt)}</b>. </> : null}
          As compras que ela tinha conferido voltaram ao que eram antes: o valor de antes e sem a marca de conferida.
          {invoiceImport.summary.to_create ? <> As compras novas que ela tinha adicionado foram apagadas.</> : null}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="dark" onClick={onNewUpload} style={touchHeight(touch)}>Conciliar a fatura de novo</Btn>
          <Btn variant="outGray" onClick={onOpenInvoice} style={touchHeight(touch)}>Ver a fatura</Btn>
        </div>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Rascunho
// --------------------------------------------------------------------------------------------

function InvoiceDraftView({ organizationId, card, cardPublicId, importId, isMobile, onConcluded = null }) {
  const navigate = useNavigate();
  const cardId = card.id;
  const [invoiceImport, setImportRaw] = useState(null);
  // Lançamentos que não mudaram mantêm o mesmo objeto: as linhas memoizadas não re-renderizam.
  const setImport = useCallback((data) => setImportRaw((prev) => reuseUnchangedEntries(prev, data)), []);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [current, setCurrent] = useState(null);
  const [passed, setPassed] = useState(() => new Set());
  const [concluding, setConcluding] = useState(false);
  // As respostas anteriores de cada lançamento ("Desfazer escolha") e a última confirmação em lote.
  const [answerHistory, setAnswerHistory] = useState({});
  const [lastBulk, setLastBulk] = useState(null);
  // Pedidos de resposta no ar: enquanto houver um, as respostas ficam desligadas (nada de duplo PATCH).
  const [inFlight, setInFlight] = useState(0);
  const answering = inFlight > 0;
  const setAnswering = useCallback((on) => setInFlight((n) => Math.max(0, n + (on ? 1 : -1))), []);
  // Os PATCH de progresso saem em fila: o servidor fica sempre com o último passo aberto.
  const progressQueue = useRef(Promise.resolve());
  // As dúvidas em que a pessoa disse "Sim, é esta" sem escolher qual (#559) e o lançamento da busca.
  const [wantPair, setWantPair] = useState(() => new Set());
  const [searchFor, setSearchFor] = useState(null);
  // O minimizar do passo "Compras novas" (dado pelo `NewEntriesStep`), para os atalhos A/N.
  const newStepAnswered = useRef(null);
  // O formulário da compra nova (#557): categorias e etiquetas da organização, como no extrato.
  const { categories, details, error: categoriesError } = useCategories(organizationId);
  const fallbackLabel = useMemo(() => categories.find((c) => c.is_fallback)?.label || "Não classificado", [categories]);

  const reload = useCallback(
    () => getCardInvoiceImport(cardId, organizationId, importId).then(setImport),
    [cardId, organizationId, importId, setImport],
  );

  useEffect(() => {
    let alive = true;
    getCardInvoiceImport(cardId, organizationId, importId)
      .then((data) => {
        if (!alive) return;
        setImport(data);
        setCurrent(data.current_step ?? firstInvoiceStepWithWork(data.entries));
        setPassed(new Set(data.reviewed_steps ?? []));
      })
      .catch((err) => { if (alive) setLoadError(cardApiError(err)); });
    return () => { alive = false; };
  }, [cardId, organizationId, importId, setImport]);

  const stepEntries = useMemo(
    () => (invoiceImport && current ? invoiceStepItems(current, invoiceImport) : []),
    [invoiceImport, current],
  );
  // A fila (só o atual aberto) é a dos lançamentos que esta versão responde.
  const queueEntries = useMemo(() => answerableEntries(stepEntries), [stepEntries]);
  const queue = useEntryQueue(current ?? "", queueEntries, { answered: isInvoiceEntryAnswered });

  const open = (stepKey) => {
    if (!current || stepKey === current) return;
    const reviewed = new Set(passed).add(current);
    setPassed(reviewed);
    setCurrent(stepKey);
    setLastBulk(null);
    const progress = { current_step: stepKey, reviewed_steps: INVOICE_STEPS.map((s) => s.key).filter((key) => reviewed.has(key)) };
    progressQueue.current = progressQueue.current
      .then(() => updateCardInvoiceImportProgress(cardId, organizationId, importId, progress))
      .catch((err) => setActionError(cardApiError(err)));
  };

  // O lançamento que o PATCH devolveu entra na tela no mesmo commit em que o cartão recolhe: a linha
  // nasce na forma respondida final (a âncora do recolher mede essa linha, BUG-12 do extrato).
  const showSaved = useCallback((entryId, saved) => {
    if (saved?.id !== entryId) return;
    setImportRaw((prev) => (prev ? { ...prev, entries: prev.entries.map((e) => (e.id === entryId ? { ...e, ...saved } : e)) } : prev));
  }, []);

  // Grava uma mudança num lançamento (um campo da compra nova, ou uma resposta). `onSaved` roda assim
  // que o backend aceita, antes de reler o rascunho: é onde uma resposta recolhe o cartão. Devolve
  // `false` quando não gravou (o cartão fica aberto, com o erro da página).
  const changeEntry = async (entryId, body, { onSaved = null } = {}) => {
    setAnswering(true);
    setActionError("");
    try {
      showSaved(entryId, await updateCardInvoiceEntry(cardId, organizationId, importId, entryId, body));
      onSaved?.();
      await reload();
      return true;
    } catch (err) {
      setActionError(cardApiError(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // Uma resposta recusada com 409 (a transação foi escolhida por outro lançamento, ou mudou): a tela
  // estava lendo um rascunho velho. Relê, sem apagar o erro, para as opções mostrarem o estado de agora.
  const reloadOnConflict = (err) => {
    if (err?.response?.status === 409) reload().catch(() => {});
  };

  // A busca abre limpa: o erro de uma resposta anterior não fica pendurado nela.
  const openSearch = useCallback((entry) => {
    setActionError("");
    setSearchFor(entry);
  }, []);

  // O Confirmar do formulário da compra nova (#557): grava a confirmação (a descrição já foi gravada
  // pelo campo). Já confirmada, só recolhe.
  const confirmNew = (entry) => (entry.confirmed ? Promise.resolve(true) : changeEntry(entry.id, { confirmed: true }));

  // Responder confirma e recolhe no clique, sem espera; clicar de novo na resposta marcada também.
  // "Não, adicionar agora" (#557) deixa o cartão aberto com o formulário e o Confirmar ao lado: a
  // resposta fica gravada sem confirmar até o Confirmar.
  //
  // `extra` (#559): a transação escolhida (`transaction_id`) numa dúvida ou na busca. A mesma resposta
  // com outra transação é uma resposta nova. O "Desfazer escolha" guarda a transação anterior de uma
  // dúvida; o de uma primeira resposta (o lançamento vinha sem resposta) volta a "sem resposta"
  // (`{answer: null, confirmed: false}`, nunca com `transaction_id`).
  const answer = async (entry, value, extra = {}) => {
    const sameTarget = extra.transaction_id === undefined || extra.transaction_id === entry.paired_transaction_id;
    if (value === entry.answer && entry.confirmed && sameTarget) {
      queue.advanceFrom(entry.id);
      return true;
    }
    if (value === "create" && entry.answer === "create") return true;
    setAnswering(true);
    setActionError("");
    try {
      const body = value === "create" ? { answer: value, confirmed: false } : { answer: value, ...extra };
      showSaved(entry.id, await updateCardInvoiceEntry(cardId, organizationId, importId, entry.id, body));
      const previous = { answer: entry.answer, confirmed: entry.answer === null ? false : entry.confirmed };
      if (entry.classification === "doubt" && linksTransaction(entry.answer) && entry.paired_transaction_id !== null) {
        previous.transaction_id = entry.paired_transaction_id;
      }
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: [...(prev[entry.id] ?? []), previous] }));
      setWantPair((prev) => {
        if (!prev.has(entry.id)) return prev;
        const nextSet = new Set(prev);
        nextSet.delete(entry.id);
        return nextSet;
      });
      if (value !== "create") queue.advanceFrom(entry.id);
      setLastBulk(null);
      await reload();
      return true;
    } catch (err) {
      setActionError(cardApiError(err));
      reloadOnConflict(err);
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // Escolher uma opção da dúvida ou da busca (#559): nesta fatura, "Sim, é esta"; na vizinha, "Mover"
  // (a parcela segue a sugestão do backend). A já escolhida só recolhe. Já escolhida por outro
  // lançamento, ou numa fatura paga (decisão 1), não responde (a opção mostra o motivo).
  const pick = async (entry, candidate) => {
    if (linksTransaction(entry.answer) && entry.paired_transaction_id === candidate.id) {
      if (entry.confirmed) {
        queue.advanceFrom(entry.id);
        return true;
      }
      return answer(entry, entry.answer, { transaction_id: candidate.id });
    }
    const invoice = invoiceImport.invoice;
    if (takenByOf(invoiceImport.entries, entry.id, candidate.id) || pickRefusal(candidate, invoice)) return false;
    return answer(entry, pickAnswerOf(candidate, invoice), { transaction_id: candidate.id });
  };

  // "Sim, é esta" numa dúvida sem escolher: com uma opção livre, escolhe-a; com várias, pede para
  // escolher qual; sem nenhuma, abre a busca (como no extrato, `doubtYes`).
  const doubtYes = (entry) => {
    if (linksTransaction(entry.answer)) {
      if (entry.confirmed) queue.advanceFrom(entry.id);
      else answer(entry, entry.answer, { transaction_id: entry.paired_transaction_id });
      return;
    }
    const invoice = invoiceImport.invoice;
    const free = (entry.candidates ?? []).filter((c) => !takenByOf(invoiceImport.entries, entry.id, c.id) && !pickRefusal(c, invoice));
    if (free.length === 1) pick(entry, free[0]);
    else if (free.length > 1) setWantPair((prev) => new Set(prev).add(entry.id));
    else openSearch(entry);
  };

  // "Mover só esta" ⇄ "Mover esta e as próximas" na dúvida respondida com uma parcela da vizinha.
  const changeMove = (entry, value) => {
    if (value === entry.answer) return;
    answer(entry, value, { transaction_id: entry.paired_transaction_id });
  };

  // O grupo de encargos (#558): responder confirma e recolhe no clique; a resposta já marcada e ainda
  // não confirmada (a sugestão "A soma bate", o "Não registrar" de uma fatura paga) só confirma.
  // O backend devolve o rascunho inteiro: os lançamentos do grupo mudam junto, no mesmo commit.
  const answerGroup = async (item, value) => {
    if (value === item.answer && item.confirmed) {
      queue.advanceFrom(item.id);
      return;
    }
    if (chargeGroupAnswerUnavailable(item.group, value)) return;
    setAnswering(true);
    setActionError("");
    try {
      const body = value === item.answer ? { confirmed: true } : { answer: value };
      setImport(await updateCardInvoiceChargeGroup(cardId, organizationId, importId, item.id, body));
      setAnswerHistory((prev) => ({ ...prev, [item.id]: [...(prev[item.id] ?? []), { answer: item.answer, confirmed: item.confirmed }] }));
      setLastBulk(null);
      queue.advanceFrom(item.id);
    } catch (err) {
      setActionError(cardApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  // "Desfazer escolha" do grupo: a resposta e o `confirmed` anteriores. O grupo que começou sem
  // resposta volta a "sem resposta" (`{answer: null}`, que também desconfirma).
  const undoGroup = async (item) => {
    const previous = answerHistory[item.id]?.at(-1);
    if (!previous) return;
    setAnswering(true);
    setActionError("");
    try {
      const body = previous.answer === null ? { answer: null } : { answer: previous.answer, confirmed: previous.confirmed };
      setImport(await updateCardInvoiceChargeGroup(cardId, organizationId, importId, item.id, body));
      setAnswerHistory((prev) => ({ ...prev, [item.id]: prev[item.id].slice(0, -1) }));
      setLastBulk(null);
      queue.open(item.id);
    } catch (err) {
      setActionError(cardApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  // "Desfazer escolha": manda a resposta e o `confirmed` anteriores.
  const undoChoice = async (entry) => {
    const previous = answerHistory[entry.id]?.at(-1);
    if (!previous) return;
    setAnswering(true);
    setActionError("");
    try {
      await updateCardInvoiceEntry(cardId, organizationId, importId, entry.id, previous);
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: prev[entry.id].slice(0, -1) }));
      setLastBulk(null);
      queue.open(entry.id);
      await reload();
    } catch (err) {
      setActionError(cardApiError(err));
      reloadOnConflict(err);
    } finally {
      setAnswering(false);
    }
  };

  const confirmAll = async (entryIds, confirmed) => {
    setAnswering(true);
    setActionError("");
    try {
      setImport(await confirmCardInvoiceSuggestions(cardId, organizationId, importId, entryIds, confirmed));
      setLastBulk(confirmed ? entryIds : null);
      if (confirmed) queue.close(null);
      else if (entryIds.length) queue.open(entryIds[0]);
      return true;
    } catch (err) {
      setActionError(cardApiError(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // "Próximo": confirma as escolhas do passo que faltam confirmar (nada muda no Fincla) e avança.
  // Um lote só, tudo ou nada: uma falha não deixa metade confirmada. Os lançamentos (sugestões,
  // Adicionar, Não registrar) vão em `entries`; o grupo de encargos (#558) vai em `groups`, nunca os
  // lançamentos dele (o backend recusa um lançamento do grupo sozinho).
  const next = async (stepKey) => {
    const unconfirmed = unconfirmedEntries(stepEntries);
    if (unconfirmed.length) {
      const groups = unconfirmed.filter(isChargeGroupItem);
      const entries = unconfirmed.filter((e) => !isChargeGroupItem(e));
      setAnswering(true);
      setActionError("");
      try {
        const confirm = (e) => ({ id: e.id, confirmed: true });
        setImport(await updateCardInvoiceEntries(cardId, organizationId, importId, entries.map(confirm), groups.map(confirm)));
      } catch (err) {
        setActionError(cardApiError(err));
        return;
      } finally {
        setAnswering(false);
      }
    }
    setLastBulk(null);
    open(stepKey);
  };

  const conclude = async () => {
    setConcluding(true);
    setActionError("");
    try {
      setImport(await concludeCardInvoiceImport(cardId, organizationId, importId));
      // A conclusão mexe nas transações e na fatura: as outras telas buscam de novo (como no desfazer).
      onConcluded?.();
    } catch (err) {
      setActionError(cardApiError(err));
      await reload().catch(() => {});
    } finally {
      setConcluding(false);
    }
  };

  // O Confirmar pelo atalho A numa compra nova: só com descrição (a mesma regra do botão).
  const confirmNewAndAdvance = async (entry, advance = queue.advanceFrom) => {
    if (!String(entry.description ?? "").trim()) return;
    if (await confirmNew(entry)) advance(entry.id);
  };
  // O minimizar do passo 5 é o do `NewEntriesStep`: guarda o "como estava" para o "Desfazer escolha".
  const newAnswered = (id) => (newStepAnswered.current ? newStepAnswered.current(id) : queue.advanceFrom(id));
  // S/A/N respondem a compra aberta (só com a fileira de respostas inteira à vista, como no extrato).
  const shortcutsByStep = {
    suggested: {
      s: (e) => (invoiceAnswerUnavailable(e, "pair") ? null : answer(e, "pair")),
      // "Não, adicionar agora" já marcado: o A confirma, como o clique na resposta e o passo 5.
      a: (e) => {
        if (invoiceAnswerUnavailable(e, "create")) return null;
        return e.answer === "create" ? confirmNewAndAdvance(e) : answer(e, "create");
      },
      n: (e) => (invoiceAnswerUnavailable(e, "ignore") ? null : answer(e, "ignore")),
    },
    new: {
      a: (e) => {
        if (invoiceAnswerUnavailable(e, "create")) return null;
        return e.answer === "create" ? confirmNewAndAdvance(e, newAnswered) : changeEntry(e.id, { answer: "create", confirmed: false });
      },
      n: (e) => (e.answer === "ignore"
        ? confirmNew(e).then((ok) => ok && newAnswered(e.id))
        : changeEntry(e.id, { answer: "ignore" }, { onSaved: () => newAnswered(e.id) })),
    },
  };
  // Passo 3 (#559): S é "Sim, é esta" (escolhe a opção livre, pede a escolha ou abre a busca).
  shortcutsByStep.doubt = {
    s: (e) => doubtYes(e),
    a: shortcutsByStep.suggested.a,
    n: shortcutsByStep.suggested.n,
  };
  // Passo 2 (#559): S é mover como a sugestão (ou o que der); A, adicionar como nova; N, não registrar.
  shortcutsByStep.other_invoice = {
    s: (e) => {
      const options = [e.suggested_answer, "move", "move_series"].filter(Boolean);
      const value = options.find((v) => !otherInvoiceAnswerUnavailable(e, v));
      return value ? answer(e, value) : null;
    },
    a: shortcutsByStep.suggested.a,
    n: shortcutsByStep.suggested.n,
  };
  // Passo 4 (#558): no grupo, S/A/N são as três respostas dele; nos outros, A/N como no passo 5.
  const groupOr = (key, value) => (e) => {
    if (isChargeGroupItem(e)) return chargeGroupAnswerUnavailable(e.group, value) ? null : answerGroup(e, value);
    return shortcutsByStep.new[key]?.(e) ?? null;
  };
  shortcutsByStep.charges = { s: groupOr("s", "pair_sum"), a: groupOr("a", "create"), n: groupOr("n", "ignore") };
  const shortcutAnswers = shortcutsByStep[current] ?? {};
  const listOpen = Boolean(invoiceImport?.status === "draft" && QUEUE_STEPS.has(current) && queue.total && !searchFor);
  useQueueShortcuts(listOpen ? queue : null, shortcutAnswers, { disabled: answering });

  const openInvoice = () => navigate({ to: invoiceDashboardPath(cardPublicId, invoiceImport.invoice.year, invoiceImport.invoice.month) });

  if (loadError) {
    // Rascunho parado há 30 dias (`draft_expired`) ou que não existe mais: a mensagem do backend e o envio.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <ErrorNote>{loadError}</ErrorNote>
        <Btn variant="outGray" onClick={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId) })} style={touchHeight(isMobile)}>Enviar o PDF da fatura</Btn>
      </div>
    );
  }
  if (!invoiceImport || !current) return <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando a conciliação da fatura…</p>;
  if (invoiceImport.status === "concluded") {
    return (
      <DoneView
        invoiceImport={invoiceImport}
        cardId={cardId}
        organizationId={organizationId}
        touch={isMobile}
        onOpenInvoice={openInvoice}
        onUndo={() => navigate({ to: cardInvoiceUndoPath(cardPublicId, invoiceImport.id) })}
      />
    );
  }
  if (invoiceImport.status === "undone") {
    return <UndoneInvoiceView invoiceImport={invoiceImport} touch={isMobile} onOpenInvoice={openInvoice} onNewUpload={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId) })} />;
  }

  const step = INVOICE_STEPS.find((s) => s.key === current) ?? INVOICE_STEPS[0];
  const stepIndex = INVOICE_STEPS.indexOf(step);
  const previous = INVOICE_STEPS[stepIndex - 1];
  const following = INVOICE_STEPS[stepIndex + 1];
  const stepPending = pendingEntries(stepEntries).length;
  const stepUnconfirmed = unconfirmedEntries(stepEntries).length;
  const readOnly = stepEntries.filter((e) => !e.answerable);
  // Os já conferidos (reimportação do mesmo PDF) aparecem no passo 1, só para leitura.
  const conferred = current === "suggested" ? reconciledEntries(invoiceImport.entries) : [];
  const form = { categories, details, fallbackLabel, cardName: invoiceImport.credit_card.name, invoiceMonth: invoiceMonthLabel(invoiceImport.invoice) };
  // O que falta no passo, pelo estado de cada item (QA F4 OBS-03): as mesmas palavras do trilho.
  const noun = current === "charges" ? CHARGE_NOUN : PURCHASE_NOUN;
  const remaining = stepRemaining(queueEntries, noun.one, noun.many);
  const discardDraft = () => discardCardInvoiceImport(cardId, organizationId, importId);
  const backToUpload = () => navigate({ to: cardInvoiceReconciliationPath(cardPublicId) });
  const searchEntry = searchFor ? (invoiceImport.entries.find((e) => e.id === searchFor.id) ?? searchFor) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Breadcrumb invoiceImport={invoiceImport} touch={isMobile} onCards={() => navigate({ to: "/cards" })} onInvoice={openInvoice} />
        <PageTitle sans="Conciliar" serif="fatura" />
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          {NOTHING_CHANGES} Suas respostas ficam salvas: dá para fechar e continuar depois.
        </p>
        <ContextChips invoiceImport={invoiceImport} />
        <div>
          <DiscardDraftControl
            organizationId={organizationId}
            importId={importId}
            discard={discardDraft}
            onDiscarded={backToUpload}
            touch={isMobile}
          />
        </div>
      </div>
      {invoiceImport.changed_since_read ? (
        <StaleDraftNotice organizationId={organizationId} importId={importId} touch={isMobile} discard={discardDraft} onDiscarded={backToUpload} />
      ) : null}
      <RecognitionNotice invoiceImport={invoiceImport} touch={isMobile} onOtherCard={() => navigate({ to: "/cards" })} />
      <OtherCardNotice cardCheck={invoiceImport.card_check} touch={isMobile} onOpenCard={(other) => navigate({ to: cardInvoiceReconciliationPath(other.public_id) })} />
      <FileCheckNotice fileCheck={invoiceImport.file_check} touch={isMobile} onOpenPrevious={(id) => navigate({ to: cardInvoiceReconciliationPath(cardPublicId, id) })} />
      <ProgressPanel invoiceImport={invoiceImport} passed={passed} isMobile={isMobile} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `${RAIL_WIDTH}px minmax(0, 1fr)`, gap: 16, alignItems: "start" }}>
        <StepRail
          steps={INVOICE_STEPS}
          statusOf={(key) => invoiceStepStatus(key, invoiceImport, passed.has(key))}
          current={current}
          touch={isMobile}
          onOpen={open}
          label="Etapas da conciliação da fatura"
          currentText="Você está aqui"
          separatorBefore={INVOICE_RAIL_SEPARATOR}
        />
        <main style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <header>
            <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>{step.title}</h2>
            <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>{step.todo}</p>
            {step.then ? <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: "4px 0 0" }}>{step.then}</p> : null}
          </header>
          {current !== "summary" ? <ErrorNote>{actionError}</ErrorNote> : null}
          {QUEUE_STEPS.has(current) && queueEntries.length ? <ErrorNote>{categoriesError}</ErrorNote> : null}
          {conferred.length ? <ReconciledEntries entries={conferred} /> : null}

          {current === "suggested" && queueEntries.length ? (
            <InvoiceSuggestedStep
              entries={queueEntries}
              queue={queue}
              invoiceMonth={invoiceMonthLabel(invoiceImport.invoice)}
              isMobile={isMobile}
              busy={answering}
              history={answerHistory}
              lastBulk={lastBulk}
              form={form}
              onAnswer={answer}
              onChange={changeEntry}
              onConfirmNew={(entry) => confirmNew(entry).then((ok) => ok && queue.advanceFrom(entry.id))}
              onUndoChoice={undoChoice}
              onConfirmAll={(ids) => confirmAll(ids, true)}
              onUndoConfirmAll={() => confirmAll(lastBulk, false)}
              pendingText={remaining.header}
            />
          ) : null}
          {CHOICE_STEPS.has(current) && queueEntries.length ? (
            <InvoiceChoiceStep
              key={current}
              stepKey={current}
              entries={queueEntries}
              allEntries={invoiceImport.entries}
              invoice={invoiceImport.invoice}
              queue={queue}
              isMobile={isMobile}
              busy={answering}
              history={answerHistory}
              wantPair={wantPair}
              form={form}
              pendingText={remaining.header}
              handlers={{
                onAnswer: answer,
                onPick: pick,
                onMove: changeMove,
                onYes: doubtYes,
                onSearch: openSearch,
                onChange: changeEntry,
                onConfirmNew: (entry) => confirmNew(entry).then((ok) => ok && queue.advanceFrom(entry.id)),
                onUndoChoice: undoChoice,
              }}
            />
          ) : null}
          {current === "charges" && queueEntries.length ? (
            <InvoiceChargesStep
              key={current}
              groupItem={queueEntries.find(isChargeGroupItem) ?? null}
              entries={queueEntries.filter((e) => !isChargeGroupItem(e))}
              queue={queue}
              form={form}
              invoiceMonth={invoiceMonthLabel(invoiceImport.invoice)}
              isMobile={isMobile}
              answering={answering}
              groupHistory={answerHistory[queueEntries.find(isChargeGroupItem)?.id] ?? []}
              onAnswerGroup={answerGroup}
              onUndoGroup={undoGroup}
              onChangeEntry={changeEntry}
              onConfirmEntry={confirmNew}
              answeredRef={newStepAnswered}
              pendingText={remaining.header}
            />
          ) : null}
          {current === "new" && queueEntries.length ? (
            <InvoiceNewStep
              key={current}
              entries={queueEntries}
              queue={queue}
              form={form}
              isMobile={isMobile}
              answering={answering}
              onChangeEntry={changeEntry}
              onConfirmEntry={confirmNew}
              answeredRef={newStepAnswered}
              pendingText={remaining.header}
            />
          ) : null}
          {INVOICE_ENTRY_STEPS.has(current) && readOnly.length ? <ReadOnlyEntries entries={readOnly} /> : null}
          {current !== "summary" && !stepEntries.length && !conferred.length ? <EmptyStep>{EMPTY_TEXT[current]}</EmptyStep> : null}
          {current === "summary" ? (
            <SummaryStep invoiceImport={invoiceImport} concluding={concluding} error={actionError} touch={isMobile} onConclude={conclude} />
          ) : null}

          {/* O fim do passo: "← passo anterior" e "Próximo", no fim do conteúdo (no celular só o
              aviso de pendentes fica fixo). "Próximo" fica desligado enquanto houver pendente. */}
          <div data-testid="step-footer" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {previous ? <Btn variant="ghost" onClick={() => open(previous.key)} style={touchHeight(isMobile)}>← {previous.title}</Btn> : null}
            <span style={{ flex: 1 }} />
            {following ? (
              <>
                <span style={{ ...G, fontSize: 12, color: T.inkMid }}>
                  {stepUnconfirmed && !stepPending
                    ? `Ao avançar, ${stepUnconfirmed === 1 ? "a escolha que falta confirmar fica confirmada" : `as ${stepUnconfirmed} escolhas que faltam confirmar ficam confirmadas`}. Nada muda no Fincla até você concluir.`
                    : "Nada muda no Fincla até você concluir, no último passo."}
                </span>
                <Btn variant="dark" disabled={stepPending > 0 || answering} onClick={() => next(following.key)} style={touchHeight(isMobile)}>
                  Próximo: {following.title} →
                </Btn>
              </>
            ) : null}
          </div>
        </main>
      </div>
      {/* O aviso de quanto falta no passo leva ao primeiro pendente; some com 0. */}
      {QUEUE_STEPS.has(current) ? (
        <GoToPendingButton
          key={`pending-${current}`}
          queue={queue}
          noun={noun}
          label={remaining.footer}
          isMobile={isMobile}
          indent={isMobile ? 0 : RAIL_WIDTH + 16}
        />
      ) : null}
      {searchEntry ? (
        <FinclaSearchDialog
          organizationId={organizationId}
          importId={importId}
          entry={searchEntry}
          entries={invoiceImport.entries}
          busy={answering}
          copy={INVOICE_SEARCH_COPY}
          amountText={invoiceSearchAmount}
          pickError={actionError}
          search={(query) => searchCardInvoiceEntry(cardId, organizationId, importId, searchEntry.id, query)}
          renderResult={(candidate) => (
            <InvoiceSearchResult
              key={candidate.id}
              entry={searchEntry}
              entries={invoiceImport.entries}
              invoice={invoiceImport.invoice}
              candidate={candidate}
              busy={answering}
              onPick={async (picked) => { if (await pick(searchEntry, picked)) setSearchFor(null); }}
            />
          )}
          onClose={() => { setSearchFor(null); setActionError(""); }}
        />
      ) : null}
    </div>
  );
}

export function CardInvoiceReconciliationPage({ organizationId, isMobile = false, onConcluded = null }) {
  const { cardId: cardPublicId, importId } = useParams({ strict: false });
  const { card, error, loaded } = useCardOf(organizationId, cardPublicId);
  if (!organizationId || !cardPublicId) return null;
  let body;
  if (error) body = <ErrorNote>{error}</ErrorNote>;
  else if (!loaded) body = <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando o cartão…</p>;
  else if (!card) body = <ErrorNote>Cartão não encontrado ou sem acesso.</ErrorNote>;
  else if (importId) {
    body = <InvoiceDraftView key={`${cardPublicId}:${importId}`} organizationId={organizationId} card={card} cardPublicId={cardPublicId} importId={importId} isMobile={isMobile} onConcluded={onConcluded} />;
  } else {
    body = <InvoiceUploadView key={cardPublicId} organizationId={organizationId} card={card} cardPublicId={cardPublicId} isMobile={isMobile} />;
  }
  return (
    <TouchTargets on={isMobile}>
      <div data-testid="card-invoice-reconciliation-page" style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        {body}
      </div>
    </TouchTargets>
  );
}
