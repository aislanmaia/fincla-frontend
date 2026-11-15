// Conciliar extrato (fincla-api#507, primeira entrega #508).
//
// `/accounts/$accountId/reconcile` envia o arquivo; `/accounts/$accountId/reconcile/$importId`
// é o rascunho guiado pelos 8 passos. Nada muda no Fincla até "Concluir conciliação": cada
// resposta é gravada no rascunho, e as contagens e os bloqueios vêm do backend (a tela não
// recalcula nada).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Check, FileUp } from "lucide-react";

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
  getStatementImport,
  listStatementImports,
  updateStatementEntries,
  updateStatementEntry,
  updateStatementGroup,
  updateStatementImportProgress,
  uploadStatement,
} from "../../api/statementImports";
import {
  STEPS,
  blockerText,
  entriesOfStep,
  firstStepWithWork,
  stepStatus,
} from "../features/statementImport/reconciliationSteps.js";
import { bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";
import { NewEntriesStep } from "../features/statementImport/NewEntriesStep.jsx";
import { ColumnMappingCard } from "../features/statementImport/ColumnMappingCard.jsx";
import { SuggestedPairsStep } from "../features/statementImport/SuggestedPairsStep.jsx";
import { DoubtCard, DoubtStep, answerSnapshot, pairBody } from "../features/statementImport/DoubtStep.jsx";
import { FinclaSearchDialog } from "../features/statementImport/FinclaSearchDialog.jsx";
import { statementImportUndoPath, statementReconciliationPath } from "../routing/statementImportRoute.js";
import { ErrorNote, ImportUndoneCard, LINK } from "../features/statementImport/StatementImportNotes.jsx";
import {
  DiscardDraftControl,
  DraftInProgressCard,
  ImportedStatementsList,
} from "../features/statementImport/ImportedStatements.jsx";

/** Passos em que cada lançamento é adicionado, somado ou fica de fora (fincla-api#513). */
const ENTRY_STEPS = new Set(["yield", "new"]);

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

const ACCEPTED_FILES = ".ofx,.xls,.xlsx,.csv,application/x-ofx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

function UploadView({ organizationId, accountId, accountName, beforeUpload = null }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // A planilha que o Fincla não reconheceu: a pessoa indica as colunas e o mesmo arquivo é reenviado.
  const [preview, setPreview] = useState(null);

  const send = async (columnMapping = null) => {
    if (!file) return;
    setSending(true);
    setError("");
    try {
      const draft = await uploadStatement(accountId, organizationId, file, columnMapping);
      navigate({ to: statementReconciliationPath(accountId, draft.id) });
    } catch (err) {
      const asked = columnMappingPreviewOf(err);
      if (asked && !columnMapping) setPreview(asked);
      else setError(handleApiError(err));
      setSending(false);
    }
  };

  const pick = (chosen) => {
    setFile(chosen);
    setError("");
    setPreview(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Importar" serif="extrato" />
      <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
        {accountName ? <>Conta <b>{accountName}</b>. </> : null}
        Envie o extrato da conta corrente exportado pelo banco: OFX, planilha (XLS ou XLSX) ou CSV. O Fincla lê
        os lançamentos e você confere cada um antes de qualquer coisa entrar.
      </p>
      {beforeUpload}
      {preview && file ? (
        <ColumnMappingCard
          key={file.name}
          preview={preview}
          fileName={file.name}
          sending={sending}
          error={error}
          onSubmit={(mapping) => send(mapping)}
          onCancel={() => pick(null)}
        />
      ) : (
        <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="statement-file" style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>
            Arquivo do extrato (OFX, XLS, XLSX ou CSV, até 5 MB)
          </label>
          <input
            id="statement-file"
            type="file"
            accept={ACCEPTED_FILES}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            style={{ ...G, fontSize: 13 }}
          />
          <ErrorNote>{error}</ErrorNote>
          <div>
            <Btn variant="dark" onClick={() => send()} disabled={!file || sending}>
              <FileUp size={14} aria-hidden="true" style={{ marginRight: 6 }} />
              {sending ? "Enviando…" : "Enviar extrato"}
            </Btn>
          </div>
        </Card>
      )}
      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0 }}>
        {NOTHING_CHANGES} O arquivo não fica guardado: só os lançamentos lidos.
      </p>
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

function AccountStatementsView({ organizationId, accountId, accountName }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    () => listStatementImports(accountId, organizationId)
      .then((list) => { setItems(list); setError(""); })
      .catch((err) => setError(handleApiError(err))),
    [accountId, organizationId],
  );
  useEffect(() => { load(); }, [load]);

  const openImport = (item) => navigate({ to: statementReconciliationPath(accountId, item.id) });
  const drafts = (items ?? []).filter((i) => i.status === "draft");
  const onDiscarded = () => {
    setNotice("Rascunho descartado. Nada mudou nas suas transações.");
    load();
  };

  const inProgress = (
    <>
      {notice ? <p role="status" style={{ ...G, fontSize: 13, color: T.green, margin: 0 }}>{notice}</p> : null}
      {drafts.map((draft) => (
        <DraftInProgressCard key={draft.id} organizationId={organizationId} draft={draft} onContinue={openImport} onDiscarded={onDiscarded} />
      ))}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <UploadView organizationId={organizationId} accountId={accountId} accountName={accountName} beforeUpload={inProgress} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {items ? (
        <ImportedStatementsList
          items={items}
          onOpen={openImport}
          onUndo={(item) => navigate({ to: statementImportUndoPath(accountId, item.id) })}
        />
      ) : null}
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

function ProgressPanel({ statementImport, passed }) {
  const done = STEPS.filter((s) => stepStatus(s.key, statementImport, passed.has(s.key)).tone === "done").length;
  const { summary } = statementImport;
  return (
    <Card style={{ padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
      <div role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>
        Seu progresso: <b style={NUM}>{done}</b> de <b style={NUM}>{STEPS.length}</b> passos conferidos
        <div style={{ height: 4, background: T.grayLight, borderRadius: 99, marginTop: 6, width: 200, maxWidth: "100%" }}>
          <div style={{ height: 4, borderRadius: 99, background: T.green, width: `${(done / STEPS.length) * 100}%`, transition: "width .3s" }} />
        </div>
      </div>
      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
        <b style={NUM}>{plural(summary.total, "lançamento", "lançamentos")}</b> no extrato ·{" "}
        {summary.to_pair ? <><b style={NUM}>{summary.to_pair}</b> já no Fincla · </> : null}
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

function LeftOutStep({ entries }) {
  // Só valor zero chega aqui; "Não registrar" fica minimizado no próprio passo.
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "0 0 10px" }}>Estes lançamentos não viram transação:</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((e) => (
          <li key={e.id} data-testid="left-out-entry" style={{ ...G, fontSize: 13, color: T.ink, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>{bankDateLabel(e.date)} · {e.bank_description}</span>
            <span style={{ ...NUM, color: T.inkMid }}>{formatMoney(e.amount, e.currency)} · valor zero</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BalanceStep({ statementImport }) {
  const last = statementImport.bank_balances[statementImport.bank_balances.length - 1];
  return (
    <EmptyStep>
      Nada a fazer aqui por enquanto.
      {last ? <> O banco informa saldo de <b style={NUM}>{formatMoney(last.balance, last.currency)}</b> em {bankDateLabel(last.date)}.</> : null}
    </EmptyStep>
  );
}

/** Valores e contas que mudam ao concluir (fincla-api#511), com destaque. */
function PairChanges({ entries }) {
  const pairs = entries.filter((e) => e.answer === "pair" && e.fincla_match);
  const newValue = pairs.filter((e) => e.fincla_match.differences.includes("amount")).length;
  const moved = pairs.filter((e) => e.fincla_match.differences.includes("account")).length;
  if (!newValue && !moved) return null;
  return (
    <ul data-testid="summary-pair-changes" style={{ ...G, fontSize: 12, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "8px 12px 8px 28px", margin: "12px 0 0" }}>
      {newValue ? (
        <li><b>{plural(newValue, "transação passa", "transações passam")} a ter o valor do banco</b> (valor diferente no Fincla).</li>
      ) : null}
      {moved ? (
        <li><b>{plural(moved, "transação é movida", "transações são movidas")} para esta conta</b> (estavam em outra conta).</li>
      ) : null}
    </ul>
  );
}

function SummaryStep({ statementImport, concluding, error, onConclude, onClassify = null }) {
  const { summary, blockers } = statementImport;
  const rows = [
    ["Lançamentos no extrato", summary.total, "summary-total"],
    ["Já estavam no Fincla", summary.to_pair, "summary-to-pair"],
    ["Serão adicionados", summary.to_create, "summary-to-create"],
    ["Somados em um lançamento", summary.grouped, "summary-grouped", summary.groups ? `em ${plural(summary.groups, "transação", "transações")}` : null],
    ["Não serão registrados", summary.ignored, "summary-ignored"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <PairChanges entries={statementImport.entries} />
        {summary.to_create || summary.groups ? (
          <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "12px 0 0" }}>
            Ao concluir, cada lançamento marcado para adicionar e cada soma vira uma transação <b>paga na data do banco</b>
            {summary.groups ? " (a soma, na data do último lançamento somado)" : ""}.
          </p>
        ) : null}
      </Card>
      {summary.unclassified ? (
        <div data-testid="unclassified-warning" role="note" style={{ ...G, fontSize: 13, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
          <b>{plural(summary.unclassified, "transação vai", "transações vão")} para Não classificado.</b>
          <span>Dá para classificar agora ou depois, em Lançamentos.</span>
          {onClassify ? <button type="button" onClick={onClassify} style={{ ...LINK, fontSize: 13, color: T.blue }}>Classificar agora</button> : null}
        </div>
      ) : null}
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="extrato" />
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.green, margin: 0 }}>Conciliação concluída</h2>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
          {plural(created, "transação adicionada", "transações adicionadas")}
          {accountName ? <> à conta <b>{accountName}</b></> : null}, {created === 1 ? "paga na data do banco" : "pagas nas datas do banco"}.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenAccountTransactions ? (
            <Btn variant="dark" onClick={() => onOpenAccountTransactions(statementImport.account_id, statementPeriod(statementImport))}>Ver transações da conta</Btn>
          ) : null}
          <Btn variant="outGray" onClick={() => navigate({ to: "/accounts" })}>Voltar para Contas</Btn>
        </div>
        {/* Só a concluída mais recente da conta pode ser desfeita: as outras não ganham o caminho. */}
        {statementImport.latest_concluded ? (
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: statementImportUndoPath(statementImport.account_id, statementImport.id) })}
              style={{ ...LINK, color: T.red }}
            >
              Desfazer importação
            </button>
          </div>
        ) : null}
      </Card>
    </div>
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
  const [statementImport, setStatementImport] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [current, setCurrent] = useState(null);
  const [passed, setPassed] = useState(() => new Set());
  const [concluding, setConcluding] = useState(false);
  // Passo "Confirmar lançamentos encontrados" (fincla-api#510): cartões reabertos, respostas
  // anteriores de cada lançamento (para "Desfazer escolha") e a última confirmação em lote.
  const [openedPairs, setOpenedPairs] = useState(() => new Set());
  const [answerHistory, setAnswerHistory] = useState({});
  const [lastBulk, setLastBulk] = useState(null);
  const [answering, setAnswering] = useState(false);
  // O par que acabou de minimizar recebe o foco no "Alterar" da linha dele.
  const [focusedPair, setFocusedPair] = useState(null);
  // Dúvidas (fincla-api#511): "Sim, é esta" dito sem escolher qual, e o lançamento da busca aberta.
  const [wantPair, setWantPair] = useState(() => new Set());
  const [searchFor, setSearchFor] = useState(null);
  // Os PATCH de progresso saem em fila: o próximo só parte quando o anterior respondeu, então o
  // servidor fica sempre com o último passo aberto (fincla-api#518).
  const progressQueue = useRef(Promise.resolve());

  const reload = useCallback(
    () => getStatementImport(accountId, organizationId, importId).then(setStatementImport),
    [accountId, organizationId, importId],
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
    } catch (err) {
      setActionError(handleApiError(err));
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

  const withOpened = (entryId, isOpen) => setOpenedPairs((prev) => {
    const next = new Set(prev);
    if (isOpen) next.add(entryId);
    else next.delete(entryId);
    return next;
  });

  const answerPair = async (entry, answer) => {
    if (answer === entry.answer && entry.confirmed) return;
    setAnswering(true);
    setActionError("");
    try {
      await updateStatementEntry(accountId, organizationId, importId, entry.id, { answer });
      setAnswerHistory((prev) => ({
        ...prev,
        [entry.id]: [...(prev[entry.id] ?? []), { answer: entry.answer, confirmed: entry.confirmed }],
      }));
      // "Não, adicionar agora" deixa o cartão aberto para conferir a transação nova; as outras minimizam.
      withOpened(entry.id, answer === "create");
      if (answer !== "create") setFocusedPair(entry.id);
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
      withOpened(entry.id, body.answer === "create");
      if (body.answer && body.answer !== "create") setFocusedPair(entry.id);
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
      setOpenedPairs((prev) => new Set([...prev].filter((id) => !entryIds.includes(id))));
    } catch (err) {
      setActionError(handleApiError(err));
    } finally {
      setAnswering(false);
    }
  };

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
  const stepEntries = entriesOfStep(current, statementImport.entries);
  const { period } = statementImport;

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
      <ProgressPanel statementImport={statementImport} passed={passed} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <StepRail statementImport={statementImport} current={current} passed={passed} onOpen={open} />
        <main style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <header>
            <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>{step.title}</h2>
            <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>{step.todo}</p>
            {step.then ? <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: "4px 0 0" }}>{step.then}</p> : null}
          </header>
          {current !== "summary" ? <ErrorNote>{actionError}</ErrorNote> : null}

          {current === "suggested" && stepEntries.length ? (
            <SuggestedPairsStep
              entries={stepEntries}
              isMobile={isMobile}
              busy={answering}
              categories={categories}
              details={details}
              fallbackLabel={fallbackLabel}
              accountName={accountName}
              opened={openedPairs}
              history={answerHistory}
              lastBulk={lastBulk}
              focusId={focusedPair}
              onAnswer={answerPair}
              onChange={changeEntry}
              onUndoChoice={undoPairChoice}
              onOpen={(entry) => withOpened(entry.id, true)}
              onMinimize={(entry) => { setFocusedPair(entry.id); withOpened(entry.id, false); }}
              onConfirmAll={(ids) => confirmPairs(ids, true)}
              onUndoConfirmAll={() => confirmPairs(lastBulk, false)}
            />
          ) : null}
          {current === "doubt" && stepEntries.length ? (
            <DoubtStep
              {...doubtProps}
              entries={stepEntries}
              allEntries={statementImport.entries}
              opened={openedPairs}
              history={answerHistory}
              wantPair={wantPair}
              focusId={focusedPair}
              onOpen={(entry) => withOpened(entry.id, true)}
              onMinimize={(entry) => { setFocusedPair(entry.id); withOpened(entry.id, false); }}
            />
          ) : null}
          {ENTRY_STEPS.has(current) ? <ErrorNote>{categoriesError}</ErrorNote> : null}
          {ENTRY_STEPS.has(current) && stepEntries.length ? (
            <NewEntriesStep
              key={current}
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
              renderMatched={(entry) => (
                <DoubtCard
                  key={entry.id}
                  {...doubtProps}
                  entry={entry}
                  entries={statementImport.entries}
                  canUndo={Boolean(answerHistory[entry.id]?.length)}
                  onWantPair={() => setSearchFor(entry)}
                />
              )}
            />
          ) : null}
          {current === "outside" && stepEntries.length ? <LeftOutStep entries={stepEntries} /> : null}
          {current === "balance" ? <BalanceStep statementImport={statementImport} /> : null}
          {current === "summary" ? (
            <SummaryStep statementImport={statementImport} concluding={concluding} error={actionError} onConclude={conclude} onClassify={() => open("new")} />
          ) : null}
          {!["suggested", "doubt", "new", "yield", "balance", "summary", "outside"].includes(current) || (["suggested", "doubt", ...ENTRY_STEPS].includes(current) && !stepEntries.length) ? (
            <EmptyStep>Nada a fazer aqui: nenhum lançamento deste extrato está neste passo.</EmptyStep>
          ) : null}

          {current !== "summary" ? (
            <div>
              <Btn variant="outGray" onClick={() => open(STEPS[stepIndex + 1].key)}>Continuar</Btn>
            </div>
          ) : null}
        </main>
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
        <AccountStatementsView organizationId={organizationId} accountId={accountId} accountName={accountName} />
      )}
    </div>
  );
}
