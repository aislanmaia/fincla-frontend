// Conciliar fatura do cartão (fincla-api#554, primeira entrega #555).
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
import { Check, CreditCard, Info } from "lucide-react";

import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Btn, Card, PageTitle } from "../components/primitives";
import { plural } from "../plural.js";
import { formatMoney } from "../money/formatMoney.js";
import { handleApiError } from "../../api/client";
import { listCreditCards } from "../../api/creditCards";
import {
  concludeCardInvoiceImport,
  confirmCardInvoiceSuggestions,
  discardCardInvoiceImport,
  getCardInvoiceImport,
  invoiceDraftInProgressOf,
  updateCardInvoiceEntry,
  updateCardInvoiceImportProgress,
  uploadCardInvoice,
} from "../../api/cardInvoiceImports";
import { cardInvoiceReconciliationPath } from "../routing/cardInvoiceImportRoute.js";
import { invoiceDashboardPath } from "../routing/invoiceRoute.js";
import { EmptyStep, RAIL_WIDTH, StepRail, StickyTop } from "../features/statementImport/ReconciliationFrame.jsx";
import { ErrorNote } from "../features/statementImport/StatementImportNotes.jsx";
import { DiscardDraftControl } from "../features/statementImport/ImportedStatements.jsx";
import { StatementDropZone, usePreventFileDropOutside } from "../features/statementImport/StatementDropZone.jsx";
import { bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";
import { GoToPendingButton, reuseUnchangedEntries, useEntryQueue, useQueueShortcuts } from "../features/statementImport/entryQueue.jsx";
import {
  INVOICE_ENTRY_STEPS,
  INVOICE_RAIL_SEPARATOR,
  INVOICE_STEPS,
  answerableEntries,
  firstInvoiceStepWithWork,
  invoiceEntriesOfStep,
  invoiceMonthLabel,
  invoiceMonthName,
  invoiceStepProgress,
  invoiceStepStatus,
  invoiceSummaryRows,
  isInvoiceEntryAnswered,
  pendingEntries,
  unconfirmedEntries,
} from "../features/statementImport/invoiceSteps.js";
import { InvoiceSuggestedStep, PURCHASE_NOUN, ReadOnlyEntries } from "../features/statementImport/InvoiceSuggestedStep.jsx";

const NOTHING_CHANGES = "Nada muda no Fincla até você concluir a conciliação da fatura.";

/** O cartão da URL (`public_id`) na lista de cartões da organização: a API pede o `id` inteiro. */
function useCardOf(organizationId, cardPublicId) {
  const [state, setState] = useState({ card: null, error: "", loaded: false });
  useEffect(() => {
    if (!organizationId || !cardPublicId) return undefined;
    let alive = true;
    listCreditCards(organizationId)
      .then((cards) => { if (alive) setState({ card: cards.find((c) => c.public_id === cardPublicId) ?? null, error: "", loaded: true }); })
      .catch((err) => { if (alive) setState({ card: null, error: handleApiError(err), loaded: true }); });
    return () => { alive = false; };
  }, [organizationId, cardPublicId]);
  return state;
}

function cardName(card) {
  if (!card) return "";
  const name = card.description?.trim();
  return name || [card.brand, card.last4 ? `•${card.last4}` : null].filter(Boolean).join(" ");
}

/** dd/mm/aaaa de "YYYY-MM-DD", sem passar por `Date`. */
const fullDate = (ymd) => (ymd ? bankDateLabel(ymd) : "—");

// --------------------------------------------------------------------------------------------
// Enviar a fatura
// --------------------------------------------------------------------------------------------

/** A área de envio do PDF, na tela do cartão: envia ao escolher, como a do extrato. */
function InvoiceUploadView({ organizationId, card, cardPublicId, isMobile }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [inProgress, setInProgress] = useState(null);
  usePreventFileDropOutside();

  const send = async (chosen) => {
    setFile(chosen);
    setSending(true);
    setError("");
    setInProgress(null);
    try {
      const draft = await uploadCardInvoice(card.id, organizationId, chosen);
      navigate({ to: cardInvoiceReconciliationPath(draft.credit_card.public_id ?? cardPublicId, draft.id) });
    } catch (err) {
      const running = invoiceDraftInProgressOf(err);
      if (running) setInProgress(running);
      else setError(handleApiError(err));
      setSending(false);
    }
  };

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
      <StatementDropZone kind="invoice" touch={isMobile} readingName={sending && file ? file.name : ""} onFile={send} onError={setError} />
      <ErrorNote>{error}</ErrorNote>
      {inProgress ? (
        <div data-testid="draft-in-progress-notice" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <b>{inProgress.message || "Você já tem uma conciliação em andamento desta fatura."}</b>
          <div>
            <Btn variant="outGray" small onClick={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId, inProgress.importId) })}>Continuar conciliação</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Topo
// --------------------------------------------------------------------------------------------

const CHIP = { ...G, fontSize: 12, color: T.inkMid, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9999, padding: "4px 10px", display: "inline-flex", gap: 6, alignItems: "center" };

function Breadcrumb({ invoiceImport, onCards, onInvoice }) {
  const link = { ...G, background: "none", border: 0, padding: 0, fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer" };
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
  const { credit_card: card, invoice, entries } = invoiceImport;
  return (
    <div data-testid="invoice-chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <span style={CHIP}><CreditCard size={13} aria-hidden="true" />Cartão <b style={{ color: T.ink }}>{card.name}</b></span>
      <span style={CHIP}>Fatura <b style={{ color: T.ink }}>{invoiceMonthLabel(invoice)}</b></span>
      <span style={CHIP}>
        Vencimento <b style={{ ...NUM, color: T.ink }}>{fullDate(invoice.due_date)}</b> · fechamento <b style={{ ...NUM, color: T.ink }}>{fullDate(invoice.closing_date)}</b>
      </span>
      <span style={CHIP}>Arquivo lido do PDF · <span style={{ color: T.green, display: "inline-flex", gap: 4, alignItems: "center" }}>total conferido <Check size={12} aria-hidden="true" /></span></span>
      <span style={CHIP}><b style={{ ...NUM, color: T.ink }}>{entries.length.toLocaleString("pt-BR")}</b> {entries.length === 1 ? "lançamento" : "lançamentos"} na fatura</span>
    </div>
  );
}

/** "Reconhecemos este arquivo como a fatura do <cartão> de <mês>…", com "escolha outro cartão". */
function RecognitionNotice({ invoiceImport, onOtherCard }) {
  const { credit_card: card, invoice } = invoiceImport;
  const due = invoice.due_date ? invoice.due_date.slice(8, 10) + "/" + invoice.due_date.slice(5, 7) : null;
  return (
    <div data-testid="recognition-notice" role="note" style={{ ...G, fontSize: 13, color: T.ink, background: T.blueLight, border: `1px solid ${T.blue}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <Info size={14} aria-hidden="true" style={{ color: T.blue, flexShrink: 0, alignSelf: "center" }} />
      <span>
        Reconhecemos este arquivo como a <b>fatura do {card.name} de {invoiceMonthName(invoice.month)}</b>
        {due ? <> (vencimento <b style={NUM}>{due}</b>)</> : null}, pelo final do cartão e pelo vencimento que vêm no PDF. Se não for,{" "}
        <button type="button" onClick={onOtherCard} style={{ ...G, background: "none", border: 0, padding: 0, fontSize: 13, fontWeight: 600, color: T.blue, textDecoration: "underline", cursor: "pointer" }}>
          escolha outro cartão
        </button>.
      </span>
    </div>
  );
}

/** O PDF enviado pela tela de um cartão é de outro cartão da organização: só avisa (como a #515). */
function OtherCardNotice({ cardCheck, onOpenCard }) {
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
          <Btn variant="outGray" small onClick={() => onOpenCard(suggested)}>Conciliar no cartão {suggested.name}</Btn>
        </div>
      ) : null}
    </div>
  );
}

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

function SummaryStep({ invoiceImport, concluding, error, onConclude }) {
  const rows = invoiceSummaryRows(invoiceImport);
  const { difference_now: now, invoice, summary } = invoiceImport;
  const pending = summary.unanswered;
  const blocked = !invoiceImport.can_conclude || pending > 0;
  const why = pending ? `Falta responder ${plural(pending, "item", "itens")}.` : invoiceImport.blockers.length ? "Ainda há pendências na conciliação." : "";
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
        <Btn variant="dark" onClick={onConclude} disabled={blocked || concluding}>
          {concluding ? "Concluindo…" : "Concluir conciliação da fatura"}
        </Btn>
        {why ? <span data-testid="conclude-blocked" style={{ ...G, fontSize: 12, color: T.amber }}>{why}</span> : null}
      </div>
    </div>
  );
}

function DoneView({ invoiceImport, onOpenInvoice }) {
  const { invoice, final_difference: recorded } = invoiceImport;
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
        <div>
          <Btn variant="dark" onClick={onOpenInvoice}>Ver a fatura</Btn>
        </div>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Rascunho
// --------------------------------------------------------------------------------------------

function InvoiceDraftView({ organizationId, card, cardPublicId, importId, isMobile }) {
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
      .catch((err) => { if (alive) setLoadError(handleApiError(err)); });
    return () => { alive = false; };
  }, [cardId, organizationId, importId, setImport]);

  const stepEntries = useMemo(
    () => (invoiceImport && current ? invoiceEntriesOfStep(current, invoiceImport.entries) : []),
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
      .catch((err) => setActionError(handleApiError(err)));
  };

  // O lançamento que o PATCH devolveu entra na tela no mesmo commit em que o cartão recolhe: a linha
  // nasce na forma respondida final (a âncora do recolher mede essa linha, BUG-12 do extrato).
  const showSaved = useCallback((entryId, saved) => {
    if (saved?.id !== entryId) return;
    setImportRaw((prev) => (prev ? { ...prev, entries: prev.entries.map((e) => (e.id === entryId ? { ...e, ...saved } : e)) } : prev));
  }, []);

  // Responder confirma e recolhe no clique, sem espera; clicar de novo na resposta marcada também.
  const answer = async (entry, value) => {
    if (value === entry.answer && entry.confirmed) {
      queue.advanceFrom(entry.id);
      return;
    }
    setAnswering(true);
    setActionError("");
    try {
      showSaved(entry.id, await updateCardInvoiceEntry(cardId, organizationId, importId, entry.id, { answer: value }));
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: [...(prev[entry.id] ?? []), { answer: entry.answer, confirmed: entry.confirmed }] }));
      queue.advanceFrom(entry.id);
      setLastBulk(null);
      await reload();
    } catch (err) {
      setActionError(handleApiError(err));
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
      setActionError(handleApiError(err));
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
      setActionError(handleApiError(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // "Próximo": confirma as escolhas do passo que faltam confirmar (nada muda no Fincla) e avança.
  const next = async (stepKey) => {
    const unconfirmed = unconfirmedEntries(stepEntries).filter((e) => e.answer === "pair");
    if (unconfirmed.length && !(await confirmAll(unconfirmed.map((e) => e.id), true))) return;
    setLastBulk(null);
    open(stepKey);
  };

  const conclude = async () => {
    setConcluding(true);
    setActionError("");
    try {
      setImport(await concludeCardInvoiceImport(cardId, organizationId, importId));
    } catch (err) {
      setActionError(handleApiError(err));
      await reload().catch(() => {});
    } finally {
      setConcluding(false);
    }
  };

  // S/N respondem a compra aberta (só com a fileira de respostas inteira à vista, como no extrato).
  const shortcutAnswers = current === "suggested"
    ? {
        s: (e) => e.fincla_transaction && answer(e, "pair"),
        n: (e) => (e.value_locked && e.answer !== "ignore" ? null : answer(e, "ignore")),
      }
    : {};
  const listOpen = Boolean(invoiceImport?.status === "draft" && current === "suggested" && queue.total);
  useQueueShortcuts(listOpen ? queue : null, shortcutAnswers, { disabled: answering });

  const openInvoice = () => navigate({ to: invoiceDashboardPath(cardPublicId, invoiceImport.invoice.year, invoiceImport.invoice.month) });

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;
  if (!invoiceImport || !current) return <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando a conciliação da fatura…</p>;
  if (invoiceImport.status === "concluded") return <DoneView invoiceImport={invoiceImport} onOpenInvoice={openInvoice} />;

  const step = INVOICE_STEPS.find((s) => s.key === current) ?? INVOICE_STEPS[0];
  const stepIndex = INVOICE_STEPS.indexOf(step);
  const previous = INVOICE_STEPS[stepIndex - 1];
  const following = INVOICE_STEPS[stepIndex + 1];
  const stepPending = pendingEntries(stepEntries).length;
  const stepUnconfirmed = unconfirmedEntries(stepEntries).length;
  const readOnly = stepEntries.filter((e) => !e.answerable);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Breadcrumb invoiceImport={invoiceImport} onCards={() => navigate({ to: "/cards" })} onInvoice={openInvoice} />
        <PageTitle sans="Conciliar" serif="fatura" />
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          {NOTHING_CHANGES} Suas respostas ficam salvas: dá para fechar e continuar depois.
        </p>
        <ContextChips invoiceImport={invoiceImport} />
        <div>
          <DiscardDraftControl
            organizationId={organizationId}
            importId={importId}
            discard={() => discardCardInvoiceImport(cardId, organizationId, importId)}
            onDiscarded={() => navigate({ to: cardInvoiceReconciliationPath(cardPublicId) })}
          />
        </div>
      </div>
      <RecognitionNotice invoiceImport={invoiceImport} onOtherCard={() => navigate({ to: "/cards" })} />
      <OtherCardNotice cardCheck={invoiceImport.card_check} onOpenCard={(other) => navigate({ to: cardInvoiceReconciliationPath(other.public_id) })} />
      <ProgressPanel invoiceImport={invoiceImport} passed={passed} isMobile={isMobile} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `${RAIL_WIDTH}px minmax(0, 1fr)`, gap: 16, alignItems: "start" }}>
        <StepRail
          steps={INVOICE_STEPS}
          statusOf={(key) => invoiceStepStatus(key, invoiceImport, passed.has(key))}
          current={current}
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

          {current === "suggested" && queueEntries.length ? (
            <InvoiceSuggestedStep
              entries={queueEntries}
              queue={queue}
              invoiceMonth={invoiceMonthLabel(invoiceImport.invoice)}
              isMobile={isMobile}
              busy={answering}
              history={answerHistory}
              lastBulk={lastBulk}
              onAnswer={answer}
              onUndoChoice={undoChoice}
              onConfirmAll={(ids) => confirmAll(ids, true)}
              onUndoConfirmAll={() => confirmAll(lastBulk, false)}
            />
          ) : null}
          {INVOICE_ENTRY_STEPS.has(current) && readOnly.length ? <ReadOnlyEntries entries={readOnly} /> : null}
          {current !== "summary" && !stepEntries.length ? <EmptyStep>{EMPTY_TEXT[current]}</EmptyStep> : null}
          {current === "summary" ? (
            <SummaryStep invoiceImport={invoiceImport} concluding={concluding} error={actionError} onConclude={conclude} />
          ) : null}

          {/* O fim do passo: "← passo anterior" e "Próximo", no fim do conteúdo (no celular só o
              aviso de pendentes fica fixo). "Próximo" fica desligado enquanto houver pendente. */}
          <div data-testid="step-footer" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            {previous ? <Btn variant="ghost" onClick={() => open(previous.key)}>← {previous.title}</Btn> : null}
            <span style={{ flex: 1 }} />
            {following ? (
              <>
                <span style={{ ...G, fontSize: 12, color: T.inkMid }}>
                  {stepUnconfirmed && !stepPending
                    ? `Ao avançar, ${stepUnconfirmed === 1 ? "a escolha que falta confirmar fica confirmada" : `as ${stepUnconfirmed} escolhas que faltam confirmar ficam confirmadas`}. Nada muda no Fincla até você concluir.`
                    : "Nada muda no Fincla até você concluir, no último passo."}
                </span>
                <Btn variant="dark" disabled={stepPending > 0 || answering} onClick={() => next(following.key)}>
                  Próximo: {following.title} →
                </Btn>
              </>
            ) : null}
          </div>
        </main>
      </div>
      {/* O aviso de quanto falta no passo leva ao primeiro pendente; some com 0. */}
      {current === "suggested" ? (
        <GoToPendingButton key={`pending-${current}`} queue={queue} noun={PURCHASE_NOUN} isMobile={isMobile} indent={isMobile ? 0 : RAIL_WIDTH + 16} />
      ) : null}
    </div>
  );
}

export function CardInvoiceReconciliationPage({ organizationId, isMobile = false }) {
  const { cardId: cardPublicId, importId } = useParams({ strict: false });
  const { card, error, loaded } = useCardOf(organizationId, cardPublicId);
  if (!organizationId || !cardPublicId) return null;
  let body;
  if (error) body = <ErrorNote>{error}</ErrorNote>;
  else if (!loaded) body = <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando o cartão…</p>;
  else if (!card) body = <ErrorNote>Cartão não encontrado ou sem acesso.</ErrorNote>;
  else if (importId) {
    body = <InvoiceDraftView key={importId} organizationId={organizationId} card={card} cardPublicId={cardPublicId} importId={importId} isMobile={isMobile} />;
  } else {
    body = <InvoiceUploadView organizationId={organizationId} card={card} cardPublicId={cardPublicId} isMobile={isMobile} />;
  }
  return (
    <div data-testid="card-invoice-reconciliation-page" style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      {body}
    </div>
  );
}
