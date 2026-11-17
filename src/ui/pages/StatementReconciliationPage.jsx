// Conciliar extrato (fincla-api#507, primeira entrega #508).
//
// `/accounts/$accountId/reconcile` envia o arquivo; `/accounts/$accountId/reconcile/$importId`
// é o rascunho guiado pelos 8 passos. Nada muda no Fincla até "Concluir conciliação": cada
// resposta é gravada no rascunho, e as contagens e os bloqueios vêm do backend (a tela não
// recalcula nada).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Btn, Card, PageTitle } from "../components/primitives";
import { plural } from "../plural.js";
import { formatMoney } from "../money/formatMoney.js";
import { handleApiError } from "../../api/client";
import { listAccounts } from "../../api/accounts";
import { listTags } from "../../api/tags";
import {
  columnMappingPreviewOf,
  concludeStatementImport,
  createStatementGroup,
  deleteStatementGroup,
  confirmStatementSuggestions,
  draftInProgressOf,
  getStatementBalanceCheck,
  getStatementImport,
  listStatementImports,
  updateStatementBalanceChecks,
  updateStatementEntries,
  updateStatementEntry,
  updateStatementGroup,
  updateStatementImportProgress,
  uploadStatement,
} from "../../api/statementImports";
import {
  ADD_STEPS,
  ENTRY_BASED_STEPS,
  LIST_STEPS,
  STEPS,
  STEP_KEYS,
  blockerText,
  entriesOfStep,
  firstStepWithWork,
  stepProgress,
  stepStatus,
} from "../features/statementImport/reconciliationSteps.js";
import { summaryCountRows, unclassifiedText } from "../features/statementImport/summaryRows.js";
import { bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";
import { NewEntriesStep } from "../features/statementImport/NewEntriesStep.jsx";
import { ColumnMappingCard } from "../features/statementImport/ColumnMappingCard.jsx";
import { SuggestedPairsStep } from "../features/statementImport/SuggestedPairsStep.jsx";
import { OutsideStep } from "../features/statementImport/OutsideStep.jsx";
import { DoubtCard, DoubtRow, DoubtStep, answerSnapshot, doubtYes, pairBody } from "../features/statementImport/DoubtStep.jsx";
import {
  ViewModeContext,
  reuseUnchangedEntries,
  useEntryQueue,
  useQueueShortcuts,
} from "../features/statementImport/entryQueue.jsx";
import { getUserPreferences, updateUserPreferences } from "../../api/userPreferences";
import {
  BalanceCheckStep,
  BalanceNowPanel,
  balanceNowOf,
  SummaryDifference,
  SummaryEffects,
  ConcludeWithDifferenceNote,
  isCheckAnswered,
  unmatchedItemId,
} from "../features/statementImport/BalanceCheckStep.jsx";
import { FinclaSearchDialog } from "../features/statementImport/FinclaSearchDialog.jsx";
import { InvoicePaymentStep, invoiceLabel } from "../features/statementImport/InvoicePaymentStep.jsx";
import { statementImportUndoPath, statementReconciliationPath } from "../routing/statementImportRoute.js";
import { ErrorNote, ImportUndoneCard } from "../features/statementImport/StatementImportNotes.jsx";
import {
  DiscardDraftControl,
  ImportedStatementsList,
  ResumeDraftCard,
  continueTip,
} from "../features/statementImport/ImportedStatements.jsx";
import { StatementDropZone, usePreventFileDropOutside } from "../features/statementImport/StatementDropZone.jsx";

/** Os lançamentos da lista de um passo: nos de adicionar, os somados ficam dentro da soma. */
function queueEntriesOf(stepKey, stepEntries) {
  if (!LIST_STEPS.has(stepKey)) return [];
  return ADD_STEPS.has(stepKey) ? stepEntries.filter((e) => e.answer !== "group") : stepEntries;
}

/** O sinal com que uma transação entra no saldo: receita e estorno somam, o resto tira. */
const signedValue = (match) => (match.type === "income" || match.type === "refund" ? match.value : -match.value);

/**
 * Transações ligadas a um lançamento que estava marcado para adicionar (lançamento novo ou rendimento
 * respondido "Sim, é esta" com uma transação): a linha "Ligada ao lançamento do banco…" de "Conferir o
 * saldo", com desfazer. Derivadas das respostas do rascunho, nunca de estado da tela.
 */
export function linkedTransactions(entries) {
  return entries
    .filter((e) => e.answer === "pair" && (e.classification === "new" || e.classification === "yield") && e.paired_transaction_id != null && e.fincla_match)
    .map((e) => ({
      transactionId: e.paired_transaction_id,
      description: e.fincla_match.description,
      amount: signedValue(e.fincla_match),
      currency: e.fincla_match.currency,
      entryId: e.id,
      entryDate: e.date,
      bankDescription: e.bank_description,
    }));
}

/** Visualização Detalhada/Compacta, lembrada por pessoa no backend (padrão Detalhada). */
function useReconciliationView(onError) {
  const [view, setView] = useState("detailed");
  useEffect(() => {
    let alive = true;
    getUserPreferences()
      .then((prefs) => { if (alive) setView(prefs.statement_reconciliation_view); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const change = (next) => {
    const before = view;
    setView(next);
    updateUserPreferences({ statement_reconciliation_view: next }).catch(() => {
      setView(before);
      onError("Não foi possível guardar a visualização escolhida. Tente de novo.");
    });
  };
  return [view, change];
}

const NOTHING_CHANGES = "Nada muda no Fincla até você concluir a conciliação.";

const TONE = {
  warn: { dot: T.amber, text: T.amber },
  ready: { dot: T.blue, text: T.blue },
  done: { dot: T.green, text: T.green },
  neutral: { dot: T.inkFaint, text: T.inkLight },
};

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

const byLabel = (a, b) => (a.label || a.name).localeCompare(b.label || b.name, "pt-BR");

function useCategories(organizationId) {
  const [categories, setCategories] = useState([]);
  const [details, setDetails] = useState([]);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    if (!organizationId) return undefined;
    let alive = true;
    listTags(organizationId, "categoria")
      .then((res) => {
        if (!alive) return;
        const active = (res.tags ?? []).filter((t) => t.is_active !== false);
        setCategories(active.sort(byLabel));
      })
      .catch(() => { if (alive) setError("Não foi possível carregar as suas categorias. Recarregue a página para escolher uma."); });
    // Etiquetas (fincla-api#513): cada uma pertence a uma categoria (`parent_category_tag_id`).
    listTags(organizationId, "detalhe")
      .then((res) => {
        if (alive) setDetails((res.tags ?? []).filter((t) => t.is_active !== false && t.parent_category_tag_id).sort(byLabel));
      })
      .catch(() => { if (alive) setDetailsError("Não foi possível carregar as suas etiquetas. Recarregue a página para escolher uma."); });
    return () => { alive = false; };
  }, [organizationId]);
  // Sem categorias não há etiqueta a escolher: o aviso das categorias vem primeiro.
  return { categories, details, error: error || detailsError };
}

// --------------------------------------------------------------------------------------------
// Enviar o extrato
// --------------------------------------------------------------------------------------------

/**
 * O envio do extrato (primeira tela aprovada em 2026-11-16): a área de soltar, que envia ao escolher.
 * Planilha não reconhecida: "Indique as colunas" ocupa o lugar da área e reenvia o mesmo arquivo. O
 * mesmo arquivo com conciliação em andamento (fincla-api#516): aviso e a lista da conta recarregada.
 */
function UploadArea({ organizationId, accountId, compact = false, touch = false, tip = null, onDraftInProgress = null }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // A planilha que o Fincla não reconheceu: a pessoa indica as colunas e o mesmo arquivo é reenviado.
  const [preview, setPreview] = useState(null);
  // O mesmo arquivo já tem conciliação em andamento nesta conta (fincla-api#516): continuar nela.
  const [inProgress, setInProgress] = useState(null);

  const send = async (chosen, columnMapping = null) => {
    if (!chosen) return;
    setSending(true);
    setError("");
    setInProgress(null);
    try {
      const draft = await uploadStatement(accountId, organizationId, chosen, columnMapping);
      navigate({ to: statementReconciliationPath(accountId, draft.id) });
    } catch (err) {
      const asked = columnMappingPreviewOf(err);
      const running = draftInProgressOf(err);
      if (asked && !columnMapping) setPreview(asked);
      else if (running) {
        setPreview(null);
        setInProgress(running);
        // O rascunho pode ter nascido por outro caminho (outra aba, resposta perdida): a lista da
        // conta é buscada de novo, para o quadro "Continue de onde parou" aparecer na hora (D1).
        onDraftInProgress?.();
      } else setError(handleApiError(err));
      setSending(false);
    }
  };

  // Escolher (ou soltar) o arquivo já envia: a leitura começa na hora.
  const pick = (chosen) => {
    setFile(chosen);
    setError("");
    setPreview(null);
    setInProgress(null);
    send(chosen);
  };

  if (preview && file) {
    return (
      <div style={{ flex: "999 1 460px", minWidth: 0 }}>
        <ColumnMappingCard
          key={file.name}
          preview={preview}
          fileName={file.name}
          sending={sending}
          error={error}
          onSubmit={(mapping) => send(file, mapping)}
          onCancel={() => { setFile(null); setPreview(null); setError(""); }}
        />
      </div>
    );
  }
  return (
    <div style={{ flex: "999 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <StatementDropZone
        compact={compact}
        touch={touch}
        tip={tip}
        readingName={sending && file ? file.name : ""}
        onFile={pick}
        onError={(message) => { setPreview(null); setInProgress(null); setError(message); }}
      />
      <ErrorNote>{error}</ErrorNote>
      {inProgress ? (
        <DraftInProgressNotice
          message={inProgress.message}
          onContinue={() => navigate({ to: statementReconciliationPath(accountId, inProgress.importId) })}
        />
      ) : null}
    </div>
  );
}

/** O mesmo arquivo já tem conciliação em andamento nesta conta (fincla-api#516): só dá para continuar nela. */
function DraftInProgressNotice({ message, onContinue }) {
  return (
    <div data-testid="draft-in-progress-notice" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>{message || "Você já tem uma conciliação em andamento deste arquivo nesta conta."}</b>{" "}
        Suas respostas estão salvas nela. Para recomeçar do zero, descarte o rascunho em “Continue de onde parou”.
      </span>
      <div>
        <Btn variant="outGray" small onClick={onContinue}>Continuar conciliação</Btn>
      </div>
    </div>
  );
}

/**
 * "Este arquivo já foi importado" (fincla-api#516): só avisa. Os movimentos que a importação
 * anterior conferiu vêm recolhidos em "Ver o que fica de fora" e não entram de novo.
 */
function FileCheckNotice({ fileCheck, accountId, onOpenOutside }) {
  if (fileCheck?.status !== "already_imported") return null;
  const on = fileCheck.concluded_at ? bankDateLabel(fileCheck.concluded_at.slice(0, 10)) : "";
  const elsewhere = fileCheck.account_id && fileCheck.account_id !== accountId;
  return (
    <div data-testid="file-already-imported" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>Este arquivo já foi importado{on ? <> em <span style={NUM}>{on}</span></> : null}</b>
        {elsewhere && fileCheck.account_name ? <> na conta <b>{fileCheck.account_name}</b></> : null}.{" "}
        {elsewhere
          ? "Se ele é mesmo desta conta, pode seguir."
          : "Os lançamentos que já foram conferidos aparecem recolhidos em “Ver o que fica de fora” e não entram de novo."}
      </span>
      {!elsewhere ? (
        <div>
          <Btn variant="outGray" small onClick={onOpenOutside}>Ver o que fica de fora</Btn>
        </div>
      ) : null}
    </div>
  );
}

/** "Parece ser de outra conta" (fincla-api#515): só avisa, nunca bloqueia a conciliação. */
function OtherAccountNotice({ accountCheck, accountName }) {
  const navigate = useNavigate();
  if (accountCheck?.status !== "other_account") return null;
  const suggested = accountCheck.suggested_account;
  return (
    <div data-testid="other-account-notice" role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <span>
        <b>Este extrato parece ser de outra conta.</b>{" "}
        {suggested ? (
          <>Pelo arquivo, ele é da conta <b>{suggested.name}</b>, onde você já conciliou um extrato deste banco.</>
        ) : (
          <>A última conciliação {accountName ? <>de <b>{accountName}</b></> : "desta conta"} foi feita com o extrato de outra conta do banco.</>
        )}{" "}
        Se o arquivo é mesmo desta conta, pode seguir: nada impede a conciliação.
      </span>
      {suggested ? (
        <div>
          <Btn variant="outGray" small onClick={() => navigate({ to: statementReconciliationPath(suggested.id) })}>
            Conciliar na conta {suggested.name}
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// A conta: conciliação em andamento e Extratos importados (fincla-api#518)
// --------------------------------------------------------------------------------------------

function AccountStatementsView({ organizationId, accountId, accountName, isMobile = false }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  // O detalhe de cada rascunho (são poucos): o quadro "Continue de onde parou" mede o progresso com a
  // mesma função da conciliação aberta. `null` = não deu para ler aquele rascunho.
  const [details, setDetails] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Soltar o arquivo fora da área não pode fazer o navegador abrir o extrato e sair do Fincla.
  usePreventFileDropOutside();

  const load = useCallback(async () => {
    try {
      const list = await listStatementImports(accountId, organizationId);
      const openDrafts = list.filter((i) => i.status === "draft");
      const read = await Promise.all(openDrafts.map((d) => getStatementImport(accountId, organizationId, d.id).catch(() => null)));
      setDetails(Object.fromEntries(openDrafts.map((d, index) => [d.id, read[index]])));
      setItems(list);
      setError("");
    } catch (err) {
      setError(handleApiError(err));
    }
  }, [accountId, organizationId]);
  useEffect(() => { load(); }, [load]);

  const openImport = (item) => navigate({ to: statementReconciliationPath(accountId, item.id) });
  const loaded = items ?? [];
  const drafts = loaded.filter((i) => i.status === "draft");
  const tip = continueTip(loaded);
  const onDiscarded = () => {
    setNotice("Rascunho descartado. Nada mudou nas suas transações.");
    load();
  };
  const onConcluded = () => {
    setNotice("Conciliação concluída. Se precisar, dá para desfazer pela linha dela em Extratos importados.");
    return load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
          <PageTitle sans="Conciliar" serif="extrato" />
          {accountName ? <span style={{ ...G, fontSize: 13, color: T.inkMid }}>{accountName}</span> : null}
        </div>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0, maxWidth: 680 }}>
          Compare o extrato do banco com o Fincla quando quiser conferir o saldo. Você vê cada lançamento antes de qualquer coisa mudar.
        </p>
      </div>
      {notice ? <p role="status" style={{ ...G, fontSize: 13, color: T.green, margin: 0 }}>{notice}</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {drafts.map((draft) => (
        <ResumeDraftCard
          key={draft.id}
          organizationId={organizationId}
          draft={draft}
          detail={details[draft.id] ?? null}
          onContinue={openImport}
          onDiscarded={onDiscarded}
          onConcluded={onConcluded}
          onRefused={load}
        />
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch", minHeight: 0 }}>
        {/* A área só aparece depois da lista (G4 OBS-12): o tamanho depende de haver rascunho, e
            nascer grande para encolher em seguida faz a tela pular. Lista com erro: aparece mesmo assim. */}
        {items || error ? (
          <UploadArea
            organizationId={organizationId}
            accountId={accountId}
            compact={drafts.length > 0}
            touch={isMobile}
            tip={tip}
            onDraftInProgress={load}
          />
        ) : null}
        {items ? (
          <ImportedStatementsList
            items={items}
            isMobile={isMobile}
            onOpen={openImport}
            onUndo={(item) => navigate({ to: statementImportUndoPath(accountId, item.id) })}
          />
        ) : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Rascunho
// --------------------------------------------------------------------------------------------

function StepRail({ statementImport, current, passed, onOpen }) {
  return (
    <nav aria-label="Passos da conciliação" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {STEPS.map((step, index) => {
        const status = stepStatus(step.key, statementImport, passed.has(step.key));
        const tone = TONE[status.tone];
        const active = step.key === current;
        return (
          <button
            key={step.key}
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={() => onOpen(step.key)}
            style={{
              ...G, textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
              background: active ? T.surface : "transparent", border: `1px solid ${active ? T.border : "transparent"}`,
              boxShadow: active ? T.sm : "none", borderRadius: 10, padding: "8px 10px",
            }}
          >
            <span aria-hidden="true" style={{ ...NUM, flexShrink: 0, width: 20, height: 20, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: tone.dot, marginTop: 1 }}>
              {status.tone === "done" ? <Check size={11} /> : index + 1}
            </span>
            <span style={{ minWidth: 0 }}>
              <span data-testid="step-title" style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.ink }}>{step.title}</span>
              <span style={{ display: "block", fontSize: 11, color: tone.text, marginTop: 2 }}>{status.text}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Folga entre o topo fixo e o que ganha foco ao rolar (o cartão atual, "Alterar"…). */
const STICKY_FOCUS_GAP = 12;

/**
 * O topo fixo da conciliação: gruda no alto da área que rola, com fundo próprio para o que passa
 * por baixo não aparecer. `top: 0` grudaria ABAIXO do padding do alto da área que rola (20px no
 * computador, 14px no celular) e deixaria ali uma faixa onde o conteúdo aparece cortado (BUG-01 da
 * QA da etapa 3): o `top` negativo desse padding faz o topo encostar no alto da área que rola. Fica como filho direto da página, então vale para todos os
 * passos. Enquanto existe, reserva a altura dele no `scroll-padding-top` da área que rola: o foco
 * que a página move (cartão atual, "Alterar") nunca fica escondido atrás dele. Ao sair, devolve.
 */
function StickyTop({ children, style = null }) {
  const ref = useRef(null);
  const scrollerRef = useRef(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const scroller = ref.current?.closest("[data-fincla-main-scroll]");
    if (!scroller) return undefined;
    scrollerRef.current = scroller;
    const paddingTop = Number.parseFloat(window.getComputedStyle(scroller).paddingTop) || 0;
    setTop(paddingTop ? -paddingTop : 0);
    const previous = scroller.style.scrollPaddingTop;
    const reserve = () => { scroller.style.scrollPaddingTop = `${(ref.current?.offsetHeight ?? 0) + STICKY_FOCUS_GAP}px`; };
    reserve();
    window.addEventListener("resize", reserve);
    return () => {
      window.removeEventListener("resize", reserve);
      scroller.style.scrollPaddingTop = previous;
      scrollerRef.current = null;
    };
  }, []);
  // A altura muda com o conteúdo (o valor, a quebra de linha): a reserva acompanha a cada render.
  useEffect(() => {
    if (scrollerRef.current && ref.current) {
      scrollerRef.current.style.scrollPaddingTop = `${ref.current.offsetHeight + STICKY_FOCUS_GAP}px`;
    }
  });
  return (
    <div
      ref={ref}
      data-sticky="balance-now"
      style={{ position: "sticky", top, zIndex: 5, background: T.bg, padding: "8px 0", margin: "-8px 0", ...style }}
    >
      {children}
    </div>
  );
}

/**
 * O topo de todos os passos (história 24): o progresso e, ao lado, a diferença de saldo agora, que
 * fica FIXA ao rolar para a pessoa ver o valor mudar a cada resposta. No computador o topo inteiro
 * gruda; no celular o progresso rola com a página e só a diferença gruda, compacta, numa linha.
 */
function ProgressPanel({ statementImport, passed, balanceNow, isMobile = false }) {
  if (isMobile) {
    return (
      <>
        <div data-testid="status-bar">
          <ProgressCard statementImport={statementImport} passed={passed} />
        </div>
        <StickyTop>
          <BalanceNowPanel point={balanceNow} compact />
        </StickyTop>
      </>
    );
  }
  return (
    <StickyTop>
      <div data-testid="status-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        <ProgressCard statementImport={statementImport} passed={passed} />
        <BalanceNowPanel point={balanceNow} />
      </div>
    </StickyTop>
  );
}

function ProgressCard({ statementImport, passed }) {
  const { done } = stepProgress(statementImport, passed);
  const { summary } = statementImport;
  return (
    <Card style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", flex: "3 1 320px", minWidth: 0 }}>
      <div role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>
        Seu progresso: <b style={NUM}>{done}</b> de <b style={NUM}>{STEPS.length}</b> passos conferidos
        <div style={{ height: 4, background: T.grayLight, borderRadius: 99, marginTop: 6, width: 200, maxWidth: "100%" }}>
          <div style={{ height: 4, borderRadius: 99, background: T.green, width: `${(done / STEPS.length) * 100}%`, transition: "width .3s" }} />
        </div>
      </div>
      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
        <b style={NUM}>{plural(summary.total, "lançamento", "lançamentos")}</b> no extrato ·{" "}
        {summary.to_pair ? <><b style={NUM}>{summary.to_pair}</b> já no Fincla · </> : null}
        {summary.already_reconciled ? <><b style={NUM}>{plural(summary.already_reconciled, "já conferido antes", "já conferidos antes")}</b> · </> : null}
        <b style={NUM}>{summary.to_create}</b> para adicionar
        {summary.missing_description ? <> · <span style={{ color: T.amber }}>{plural(summary.missing_description, "sem descrição", "sem descrição")}</span></> : null}
      </div>
    </Card>
  );
}

function EmptyStep({ children }) {
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>{children}</p>
    </Card>
  );
}

function SummaryStep({ statementImport, check, checkLoading, checkError, concluding, error, onConclude, onClassify = null }) {
  const { summary, blockers } = statementImport;
  const rows = summaryCountRows(statementImport);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* A diferença de saldo que fica, em destaque no topo (fincla-api#514). */}
      <SummaryDifference check={check} loading={checkLoading} error={checkError} />
      <Card style={{ padding: 16 }}>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px" }}>
          {rows.map(([label, value, testId, note]) => (
            <div key={testId} style={{ display: "contents" }}>
              <dt style={{ ...G, fontSize: 13, color: T.inkMid }}>{label}{note ? <span style={{ fontSize: 12, color: T.inkLight }}> · {note}</span> : null}</dt>
              <dd data-testid={testId} style={{ ...G, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink, margin: 0, textAlign: "right" }}>{value}</dd>
            </div>
          ))}
        </dl>
        {summary.to_pair ? (
          <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "12px 0 0" }}>
            Ao concluir, cada transação confirmada com “Sim, é esta” fica <b>paga na data do banco</b>; descrição, data,
            categoria e etiquetas continuam como estão.
          </p>
        ) : null}
        <SummaryEffects entries={statementImport.entries} check={check} />
        {summary.to_create || summary.groups ? (
          <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "12px 0 0" }}>
            Ao concluir, cada lançamento marcado para adicionar e cada soma vira uma transação <b>paga na data do banco</b>
            {summary.groups ? " (a soma, na data do último lançamento somado)" : ""}.
          </p>
        ) : null}
      </Card>
      {summary.unclassified ? (
        <div data-testid="unclassified-warning" role="note" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
          <b>{unclassifiedText(summary)}</b>
          <span>Dá para classificar agora ou depois, em Lançamentos.</span>
          {onClassify ? <Btn variant="outGray" small onClick={onClassify}>Classificar agora</Btn> : null}
        </div>
      ) : null}
      <ConcludeWithDifferenceNote check={check} />
      {blockers.length ? (
        <div data-testid="conclude-blocked" style={{ ...G, fontSize: 13, color: T.inkMid, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px" }}>
          Ainda não dá para concluir: {blockers.map(blockerText).join(" ")}
        </div>
      ) : null}
      <ErrorNote>{error}</ErrorNote>
      <div>
        <Btn variant="dark" onClick={onConclude} disabled={!statementImport.can_conclude || concluding}>
          {concluding ? "Concluindo…" : "Concluir conciliação"}
        </Btn>
      </div>
    </div>
  );
}

/** O período que o extrato cobre: o declarado no arquivo, senão o das datas dos lançamentos. */
function statementPeriod({ period, entries }) {
  const dates = entries.map((e) => e.date).sort();
  const from = period.start ?? dates[0];
  const to = period.end ?? dates[dates.length - 1];
  return from && to ? { from, to } : null;
}

function DoneView({ statementImport, accountName, onOpenAccountTransactions }) {
  const navigate = useNavigate();
  const created = statementImport.entries.filter((e) => e.created_transaction_id != null).length
    + (statementImport.groups ?? []).filter((g) => g.created_transaction_id != null).length;
  const invoicesPaid = statementImport.entries.filter((e) => e.answer === "invoice_payment").length;
  const alreadyPaid = statementImport.entries.filter((e) => e.answer === "invoice_already_paid").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="extrato" />
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.green, margin: 0 }}>Conciliação concluída</h2>
        {/* Sem transação adicionada (só pares ou fatura), nada de "0 transações" (BUG-03). */}
        <p data-testid="done-created" style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
          {created ? (
            <>
              {plural(created, "transação adicionada", "transações adicionadas")}
              {accountName ? <> à conta <b>{accountName}</b></> : null}, {created === 1 ? "paga na data do banco" : "pagas nas datas do banco"}.
            </>
          ) : (
            accountName ? <>A conta <b>{accountName}</b> está conciliada com o extrato.</> : "A conta está conciliada com o extrato."
          )}
        </p>
        <RecordedDifference statementImport={statementImport} />
        {invoicesPaid ? (
          <p data-testid="done-invoices-paid" style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
            {plural(invoicesPaid, "fatura de cartão ficou paga", "faturas de cartão ficaram pagas")} na data do banco.
          </p>
        ) : null}
        {alreadyPaid ? (
          <p data-testid="done-invoices-already-paid" style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
            {plural(alreadyPaid, "pagamento era de uma fatura já paga", "pagamentos eram de faturas já pagas")} no Fincla: nada mudou {alreadyPaid === 1 ? "nela" : "nelas"}.
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenAccountTransactions ? (
            <Btn variant="dark" onClick={() => onOpenAccountTransactions(statementImport.account_id, statementPeriod(statementImport))}>Ver transações da conta</Btn>
          ) : null}
          <Btn variant="outGray" onClick={() => navigate({ to: "/accounts" })}>Voltar para Contas</Btn>
        </div>
        {/* Só a concluída mais recente da conta pode ser desfeita: as outras não ganham o caminho. */}
        {statementImport.latest_concluded ? (
          <div>
            <Btn variant="outRed" small onClick={() => navigate({ to: statementImportUndoPath(statementImport.account_id, statementImport.id) })}>
              Desfazer importação
            </Btn>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/** A diferença de saldo registrada ao concluir (fincla-api#514): null = o arquivo não informava saldo. */
function RecordedDifference({ statementImport }) {
  const value = statementImport.final_difference;
  if (value === null || value === undefined) {
    return <p data-testid="recorded-difference" style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>O extrato não informava saldo: nenhuma diferença foi registrada.</p>;
  }
  if (value === 0) {
    return <p data-testid="recorded-difference" style={{ ...G, fontSize: 13, color: T.green, margin: 0 }}>Saldos batendo: banco e Fincla iguais no fim do extrato.</p>;
  }
  const shown = (value > 0 ? "+" : "−") + formatMoney(Math.abs(value), statementImport.final_difference_currency);
  return (
    <p data-testid="recorded-difference" style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
      Diferença registrada: <b style={{ ...NUM, color: T.red }}>{shown}</b> (banco menos Fincla no fim do extrato). Nenhum ajuste de saldo foi feito.
    </p>
  );
}

function UndoneView({ statementImport, onOpenAccountTransactions }) {
  const navigate = useNavigate();
  const undoneOn = statementImport.undone_at ? bankDateLabel(statementImport.undone_at.slice(0, 10)) : "";
  const openTransactions = onOpenAccountTransactions
    ? () => onOpenAccountTransactions(statementImport.account_id, statementPeriod(statementImport))
    : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="extrato" />
      <ImportUndoneCard onOpenTransactions={openTransactions} onBack={() => navigate({ to: "/accounts" })}>
        Esta importação foi desfeita{undoneOn ? <> em <b style={NUM}>{undoneOn}</b></> : null}: as transações que ela adicionou
        foram apagadas. Para conciliar este extrato de novo, importe o arquivo outra vez.
      </ImportUndoneCard>
    </div>
  );
}

function DraftView({ organizationId, accountId, importId, accountName, isMobile, onOpenAccountTransactions }) {
  const navigate = useNavigate();
  const { categories, details, error: categoriesError } = useCategories(organizationId);
  const [statementImport, setStatementImportRaw] = useState(null);
  // Lançamentos que não mudaram mantêm o mesmo objeto: as linhas memoizadas não re-renderizam.
  const setStatementImport = useCallback((next) => setStatementImportRaw((prev) => reuseUnchangedEntries(prev, next)), []);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [current, setCurrent] = useState(null);
  const [passed, setPassed] = useState(() => new Set());
  const [concluding, setConcluding] = useState(false);
  // Passo "Confirmar lançamentos encontrados" (fincla-api#510): respostas anteriores de cada
  // lançamento (para "Desfazer escolha") e a última confirmação em lote.
  const [answerHistory, setAnswerHistory] = useState({});
  const [lastBulk, setLastBulk] = useState(null);
  const [answering, setAnswering] = useState(false);
  // Dúvidas (fincla-api#511): "Sim, é esta" dito sem escolher qual, e o lançamento da busca aberta.
  const [wantPair, setWantPair] = useState(() => new Set());
  const [searchFor, setSearchFor] = useState(null);
  // Os PATCH de progresso saem em fila: o próximo só parte quando o anterior respondeu, então o
  // servidor fica sempre com o último passo aberto (fincla-api#518).
  const progressQueue = useRef(Promise.resolve());
  // Conferir o saldo (fincla-api#514): calculado pelo backend a cada mudança do rascunho, nos dois
  // últimos passos.
  const [balanceCheck, setBalanceCheck] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState("");

  const reload = useCallback(
    () => getStatementImport(accountId, organizationId, importId).then(setStatementImport),
    [accountId, organizationId, importId, setStatementImport],
  );

  useEffect(() => {
    let alive = true;
    getStatementImport(accountId, organizationId, importId)
      .then((data) => {
        if (!alive) return;
        setStatementImport(data);
        // Retomar (fincla-api#518): o passo e os passos já vistos vêm do servidor.
        setCurrent(data.current_step ?? firstStepWithWork(data.entries));
        setPassed(new Set(data.reviewed_steps ?? []));
      })
      .catch((err) => { if (alive) setLoadError(handleApiError(err)); });
    return () => { alive = false; };
  }, [accountId, organizationId, importId]);

  // A lista do passo aberto (fincla-api#517): qual lançamento está aberto, filtro e avanço.
  const stepEntries = useMemo(
    () => (statementImport && current ? entriesOfStep(current, statementImport.entries) : []),
    [statementImport, current],
  );
  const listEntries = useMemo(() => queueEntriesOf(current, stepEntries), [current, stepEntries]);
  const queue = useEntryQueue(current ?? "", listEntries);
  const [view, changeView] = useReconciliationView(setActionError);

  const wantsCheck = statementImport?.status === "draft" && (current === "balance" || current === "summary");
  useEffect(() => {
    if (!wantsCheck) return undefined;
    let alive = true;
    setCheckLoading(true);
    getStatementBalanceCheck(accountId, organizationId, importId)
      .then((check) => { if (alive) { setBalanceCheck(check); setCheckError(""); } })
      .catch((err) => { if (alive) setCheckError(handleApiError(err)); })
      .finally(() => { if (alive) setCheckLoading(false); });
    return () => { alive = false; };
  }, [wantsCheck, statementImport, accountId, organizationId, importId]);
  // As transações que a pessoa ligou a um lançamento marcado para adicionar ("É este lançamento do
  // banco", ou a busca): vêm das respostas do rascunho, então continuam à vista com desfazer depois de
  // recarregar ou voltar ao passo (G3-3-08).
  const linked = useMemo(() => linkedTransactions(statementImport?.entries ?? []), [statementImport]);
  // A diferença do topo (história 24): a da conferência aberta, se já chegou; senão a do rascunho.
  const balanceNow = balanceNowOf(statementImport, wantsCheck && !checkLoading ? balanceCheck : null);
  const balanceItems = useMemo(
    () => (balanceCheck?.unmatched_transactions ?? []).map((u) => ({ ...u, id: unmatchedItemId(u) })),
    [balanceCheck],
  );
  const balanceQueue = useEntryQueue("balance", balanceItems, { answered: isCheckAnswered });
  // "Ir para eles" / "Voltar a decidir": o lançamento abre no passo dele, depois que o passo abre.
  const [openAfterStep, setOpenAfterStep] = useState(null);
  const queueOpen = queue.open;
  useEffect(() => {
    if (openAfterStep && openAfterStep.step === current) {
      queueOpen(openAfterStep.entryId);
      setOpenAfterStep(null);
    }
  }, [openAfterStep, current, queueOpen]);

  const fallbackLabel = useMemo(
    () => categories.find((c) => c.is_fallback)?.label || "Não classificado",
    [categories],
  );

  const open = (stepKey) => {
    if (!current || stepKey === current) return;
    const reviewed = new Set(passed).add(current);
    setPassed(reviewed);
    setCurrent(stepKey);
    // Grava onde a revisão está, para fechar a aba e voltar aqui (fincla-api#518).
    const progress = {
      current_step: stepKey,
      reviewed_steps: STEPS.map((s) => s.key).filter((key) => reviewed.has(key)),
    };
    progressQueue.current = progressQueue.current
      .then(() => updateStatementImportProgress(accountId, organizationId, importId, progress))
      .catch((err) => setActionError(handleApiError(err)));
  };

  const changeEntry = async (entryId, body) => {
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entryId, body);
      await reload();
      return true;
    } catch (err) {
      setActionError(handleApiError(err));
      return false;
    }
  };

  // Lote e somas respondem com a importação inteira: a tela mostra o que o backend gravou.
  // Devolve a importação (ou null se falhou), para a barra de desfazer saber o que mudou.
  const applyWhole = async (work) => {
    setActionError("");
    try {
      const updated = await work();
      setStatementImport(updated);
      return updated;
    } catch (err) {
      setActionError(handleApiError(err));
      return null;
    }
  };
  const batch = (entries) => applyWhole(() => updateStatementEntries(accountId, organizationId, importId, entries));
  const createGroup = (entryIds, description) =>
    applyWhole(() => createStatementGroup(accountId, organizationId, importId, entryIds, description));
  const updateGroup = (groupId, body) =>
    applyWhole(() => updateStatementGroup(accountId, organizationId, importId, groupId, body));
  const deleteGroup = (groupId) => applyWhole(() => deleteStatementGroup(accountId, organizationId, importId, groupId));

  // Responder abre o próximo sem resposta; "Não, adicionar agora" deixa o cartão aberto para
  // conferir a transação nova (com "Próximo sem resposta →").
  const advanceAfter = (entry, answer) => { if (answer && answer !== "create") queue.advanceFrom(entry.id); };

  const answerPair = async (entry, answer) => {
    if (answer === entry.answer && entry.confirmed) {
      advanceAfter(entry, answer);
      return;
    }
    setAnswering(true);
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entry.id, { answer });
      setAnswerHistory((prev) => ({
        ...prev,
        [entry.id]: [...(prev[entry.id] ?? []), { answer: entry.answer, confirmed: entry.confirmed }],
      }));
      advanceAfter(entry, answer);
      // A barra "N confirmados · Desfazer" falava de um estado que esta resposta mudou.
      setLastBulk(null);
      await reload();
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  const undoPairChoice = async (entry) => {
    const previous = answerHistory[entry.id]?.at(-1);
    if (!previous) return;
    setAnswering(true);
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entry.id, previous);
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: prev[entry.id].slice(0, -1) }));
      setLastBulk(null);
      // A escolha desfeita volta a ser o lançamento aberto, para responder de novo.
      queue.open(entry.id);
      await reload();
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  // Uma resposta de dúvida (ou de um lançamento pareado pela busca): guarda o que havia, com o par
  // escolhido, para "Desfazer escolha" devolver exatamente.
  const answerDoubt = async (entry, body) => {
    setAnswering(true);
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entry.id, body);
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: [...(prev[entry.id] ?? []), answerSnapshot(entry)] }));
      setWantPair((prev) => { const next = new Set(prev); next.delete(entry.id); return next; });
      // "Desfazer lá" responde OUTRO lançamento: o atual continua aberto.
      if (entry.id === queue.currentId) advanceAfter(entry, body.answer);
      setLastBulk(null);
      await reload();
      return true;
    } catch (err) {
      setActionError(handleApiError(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  const undoDoubtChoice = async (entry) => {
    const previous = answerHistory[entry.id]?.at(-1);
    if (!previous) return;
    setAnswering(true);
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entry.id, previous);
      setAnswerHistory((prev) => ({ ...prev, [entry.id]: prev[entry.id].slice(0, -1) }));
      if (entriesOfStep(current, statementImport.entries).some((e) => e.id === entry.id)) queue.open(entry.id);
      await reload();
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  // "Desfazer lá": o outro lançamento solta a transação. Uma dúvida volta a "sem resposta"; os
  // outros voltam a "adicionar" (o que eram antes de alguém escolher um par para eles).
  const undoThere = (other) => answerDoubt(other, { answer: other.classification === "doubt" ? null : "create" });

  const pickInSearch = async (match) => {
    const entry = searchFor;
    if (await answerDoubt(entry, pairBody(match))) setSearchFor(null);
  };

  const doubtProps = {
    isMobile,
    busy: answering,
    categories,
    details,
    fallbackLabel,
    accountName,
    onAnswer: answerDoubt,
    onPick: (entry, match) => answerDoubt(entry, pairBody(match)),
    onWantPair: (entry) => setWantPair((prev) => new Set(prev).add(entry.id)),
    onChange: changeEntry,
    onUndoChoice: undoDoubtChoice,
    onUndoThere: undoThere,
    onSearch: (entry) => setSearchFor(entry),
  };

  const confirmPairs = async (entryIds, confirmed) => {
    setAnswering(true);
    setActionError("");
    try {
      setStatementImport(await confirmStatementSuggestions(accountId, organizationId, importId, entryIds, confirmed));
      setLastBulk(confirmed ? entryIds : null);
      // Todas confirmadas: nenhum cartão fica aberto (todas viram linhas que se reabrem com um clique).
      // Desfeito o lote, a primeira das que voltaram a "falta confirmar" abre.
      if (confirmed) queue.close(null);
      else if (entryIds.length) queue.open(entryIds[0]);
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  const answerChecks = async (changes) => {
    setAnswering(true);
    setActionError("");
    try {
      setBalanceCheck(await updateStatementBalanceChecks(accountId, organizationId, importId, changes));
      return true;
    } catch (err) {
      setActionError(handleApiError(err));
      return false;
    } finally {
      setAnswering(false);
    }
  };

  // "É este lançamento do banco": o lançamento marcado para adicionar vira o par da transação.
  const pairFromHint = (item, entry) => answerDoubt(entry, { answer: "pair", paired_transaction_id: item.transaction_id });

  const undoLink = async (link) => {
    const entry = statementImport.entries.find((e) => e.id === link.entryId);
    if (!entry) return;
    setAnswering(true);
    setActionError("");
    try {
      // Antes de ligar, o lançamento estava marcado para adicionar: volta a isso.
      await updateStatementEntry(accountId, organizationId, importId, entry.id, { answer: "create", confirmed: false });
      await reload();
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

  /** O passo onde está um lançamento (para "Ir para eles" e "Voltar a decidir"). */
  const stepOfEntry = (entryId) => STEPS.find((s) => entriesOfStep(s.key, statementImport.entries).some((e) => e.id === entryId))?.key;
  const goToEntry = (entryId) => {
    const step = entryId ? stepOfEntry(entryId) : null;
    if (!step) return;
    open(step);
    setOpenAfterStep({ step, entryId });
  };
  const goToPending = () => goToEntry(statementImport.entries.find((e) => e.answer === null)?.id);
  const redecide = (leftOut) => goToEntry(leftOut.entry_id);

  const conclude = async () => {
    setConcluding(true);
    setActionError("");
    try {
      setStatementImport(await concludeStatementImport(accountId, organizationId, importId));
    } catch (err) {
      setActionError(handleApiError(err));
      await reload().catch(() => {});
    } finally {
      setConcluding(false);
    }
  };

  const changeAndAdvance = async (entry, answer) => {
    if (entry.answer === answer) {
      advanceAfter(entry, answer);
      return;
    }
    if (await changeEntry(entry.id, { answer })) advanceAfter(entry, answer);
  };
  // S/A/N respondem o lançamento aberto, como os botões do cartão de cada passo.
  const shortcutAnswers = {
    suggested: {
      s: (e) => e.fincla_match && answerPair(e, "pair"),
      a: (e) => answerPair(e, "create"),
      n: (e) => answerPair(e, "ignore"),
    },
    doubt: {
      s: (e) => doubtYes(e, doubtProps),
      a: (e) => e.answer !== "create" && answerDoubt(e, { answer: "create" }),
      n: (e) => (e.answer === "ignore" ? advanceAfter(e, "ignore") : answerDoubt(e, { answer: "ignore" })),
    },
    new: { s: (e) => setSearchFor(e), a: (e) => changeAndAdvance(e, "create"), n: (e) => changeAndAdvance(e, "ignore") },
    yield: { s: (e) => setSearchFor(e), a: (e) => changeAndAdvance(e, "create"), n: (e) => changeAndAdvance(e, "ignore") },
  }[current];
  const listOpen = Boolean(statementImport?.status === "draft" && LIST_STEPS.has(current) && queue.total);
  useQueueShortcuts(listOpen ? queue : null, shortcutAnswers, { disabled: Boolean(searchFor) || answering });
  // Conferir o saldo: só J/K andam pela lista de transações sem par.
  const balanceOpen = Boolean(statementImport?.status === "draft" && current === "balance" && balanceQueue.total);
  useQueueShortcuts(balanceOpen ? balanceQueue : null, {}, { disabled: answering });

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;
  if (!statementImport || !current) return <p style={{ ...G, fontSize: 13, color: T.inkLight }}>Carregando a conciliação…</p>;
  if (statementImport.status === "concluded") {
    return <DoneView statementImport={statementImport} accountName={accountName} onOpenAccountTransactions={onOpenAccountTransactions} />;
  }
  if (statementImport.status === "undone") {
    return <UndoneView statementImport={statementImport} onOpenAccountTransactions={onOpenAccountTransactions} />;
  }

  const step = STEPS.find((s) => s.key === current);
  const stepIndex = STEPS.indexOf(step);
  const { period } = statementImport;
  const listProps = { queue, view, onViewChange: changeView };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div>
        <PageTitle sans="Conciliar" serif="extrato" />
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>
          {accountName ? <><b>{accountName}</b> · </> : null}
          {period.start && period.end ? `${bankDateLabel(period.start)} a ${bankDateLabel(period.end)} · ` : null}
          {NOTHING_CHANGES} Suas respostas ficam salvas: dá para fechar e continuar depois.
        </p>
        <div style={{ marginTop: 8 }}>
          <DiscardDraftControl
            organizationId={organizationId}
            accountId={accountId}
            importId={importId}
            onDiscarded={() => navigate({ to: statementReconciliationPath(accountId) })}
          />
        </div>
      </div>
      <OtherAccountNotice accountCheck={statementImport.account_check} accountName={accountName} />
      <FileCheckNotice fileCheck={statementImport.file_check} accountId={accountId} onOpenOutside={() => open("outside")} />
      <ProgressPanel statementImport={statementImport} passed={passed} balanceNow={balanceNow} isMobile={isMobile} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <StepRail statementImport={statementImport} current={current} passed={passed} onOpen={open} />
        <ViewModeContext.Provider value={view}>
        <main style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <header>
            <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>{step.title}</h2>
            <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>{step.todo}</p>
            {step.then ? <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: "4px 0 0" }}>{step.then}</p> : null}
          </header>
          {current !== "summary" ? <ErrorNote>{actionError}</ErrorNote> : null}

          {current === "suggested" && stepEntries.length ? (
            <SuggestedPairsStep
              {...listProps}
              entries={stepEntries}
              isMobile={isMobile}
              busy={answering}
              categories={categories}
              details={details}
              fallbackLabel={fallbackLabel}
              accountName={accountName}
              history={answerHistory}
              lastBulk={lastBulk}
              onAnswer={answerPair}
              onChange={changeEntry}
              onUndoChoice={undoPairChoice}
              onConfirmAll={(ids) => confirmPairs(ids, true)}
              onUndoConfirmAll={() => confirmPairs(lastBulk, false)}
            />
          ) : null}
          {current === "invoice" && stepEntries.length ? (
            <InvoicePaymentStep entries={stepEntries} isMobile={isMobile} accountName={accountName} />
          ) : null}
          {current === "doubt" && stepEntries.length ? (
            <DoubtStep
              {...doubtProps}
              {...listProps}
              entries={stepEntries}
              allEntries={statementImport.entries}
              history={answerHistory}
              wantPair={wantPair}
            />
          ) : null}
          {ADD_STEPS.has(current) ? <ErrorNote>{categoriesError}</ErrorNote> : null}
          {ADD_STEPS.has(current) && stepEntries.length ? (
            <NewEntriesStep
              key={current}
              {...listProps}
              stepKey={current}
              entries={stepEntries}
              groups={statementImport.groups ?? []}
              categories={categories}
              details={details}
              fallbackLabel={fallbackLabel}
              isMobile={isMobile}
              onChangeEntry={changeEntry}
              onBatch={batch}
              onCreateGroup={createGroup}
              onUpdateGroup={updateGroup}
              onDeleteGroup={deleteGroup}
              onSearch={(entry) => setSearchFor(entry)}
              renderMatched={(entry, { current: isCurrent }) => (isCurrent ? (
                <DoubtCard
                  key={entry.id}
                  {...doubtProps}
                  entry={entry}
                  entries={statementImport.entries}
                  canUndo={Boolean(answerHistory[entry.id]?.length)}
                  onWantPair={() => setSearchFor(entry)}
                  onMinimize={(e) => queue.close(e.id)}
                />
              ) : (
                <DoubtRow
                  key={entry.id}
                  entry={entry}
                  canUndo={Boolean(answerHistory[entry.id]?.length)}
                  focus={queue.rowFocusId === entry.id}
                  onOpen={(e) => queue.open(e.id)}
                  onUndoChoice={undoDoubtChoice}
                />
              ))}
            />
          ) : null}
          {current === "outside" ? <ErrorNote>{categoriesError}</ErrorNote> : null}
          {current === "outside" ? (
            <OutsideStep
              entries={stepEntries}
              leftOut={statementImport.left_out}
              categories={categories}
              details={details}
              fallbackLabel={fallbackLabel}
              isMobile={isMobile}
              onChangeEntry={changeEntry}
            />
          ) : null}
          {current === "balance" && checkError ? <ErrorNote>{checkError}</ErrorNote> : null}
          {current === "balance" && !balanceCheck && !checkError ? (
            <EmptyStep>Calculando os saldos…</EmptyStep>
          ) : null}
          {current === "balance" && balanceCheck ? (
            <BalanceCheckStep
              check={balanceCheck}
              items={balanceItems}
              entries={statementImport.entries}
              periodEnd={statementImport.period.end}
              linked={linked}
              busy={answering}
              queue={balanceQueue}
              view={view}
              onViewChange={changeView}
              onAnswer={answerChecks}
              onPairHint={pairFromHint}
              onUndoLink={undoLink}
              onGoToPending={goToPending}
              onRedecide={redecide}
            />
          ) : null}
          {current === "summary" ? (
            <SummaryStep
              statementImport={statementImport}
              check={balanceCheck}
              checkLoading={checkLoading}
              checkError={checkError}
              concluding={concluding}
              error={actionError}
              onConclude={conclude}
              onClassify={() => open("new")}
            />
          ) : null}
          {!STEP_KEYS.includes(current) || (ENTRY_BASED_STEPS.has(current) && !stepEntries.length) ? (
            <EmptyStep>Nada a fazer aqui: nenhum lançamento deste extrato está neste passo.</EmptyStep>
          ) : null}

          {current !== "summary" ? (
            <div>
              <Btn variant="outGray" onClick={() => open(STEPS[stepIndex + 1].key)}>Continuar</Btn>
            </div>
          ) : null}
        </main>
        </ViewModeContext.Provider>
      </div>
      {searchFor ? (
        <FinclaSearchDialog
          organizationId={organizationId}
          accountId={accountId}
          importId={importId}
          entry={statementImport.entries.find((e) => e.id === searchFor.id) ?? searchFor}
          entries={statementImport.entries}
          accountName={accountName}
          busy={answering}
          onPick={pickInSearch}
          onUndoThere={undoThere}
          onClose={() => setSearchFor(null)}
        />
      ) : null}
    </div>
  );
}

export function StatementReconciliationPage({ organizationId, isMobile = false, onOpenAccountTransactions = null }) {
  const { accountId, importId } = useParams({ strict: false });
  const accountName = useAccountName(organizationId, accountId);
  if (!organizationId || !accountId) return null;
  return (
    <div style={{ minWidth: 0 }}>
      {importId ? (
        <DraftView
          key={importId}
          organizationId={organizationId}
          accountId={accountId}
          importId={importId}
          accountName={accountName}
          isMobile={isMobile}
          onOpenAccountTransactions={onOpenAccountTransactions}
        />
      ) : (
        <AccountStatementsView organizationId={organizationId} accountId={accountId} accountName={accountName} isMobile={isMobile} />
      )}
    </div>
  );
}
