// Conciliar extrato (fincla-api#507, primeira entrega #508).
//
// `/accounts/$accountId/reconcile` envia o arquivo; `/accounts/$accountId/reconcile/$importId`
// é o rascunho guiado pelos 8 passos. Nada muda no Fincla até "Concluir conciliação": cada
// resposta é gravada no rascunho, e as contagens e os bloqueios vêm do backend (a tela não
// recalcula nada).
import { useCallback, useEffect, useMemo, useState } from "react";
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
  concludeStatementImport,
  getStatementImport,
  updateStatementEntry,
  uploadStatement,
} from "../../api/statementImports";
import {
  STEPS,
  blockerText,
  entriesOfStep,
  firstStepWithWork,
  stepStatus,
} from "../features/statementImport/reconciliationSteps.js";
import { StatementEntryCard, bankDateLabel } from "../features/statementImport/StatementEntryCard.jsx";

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

function useCategories(organizationId) {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!organizationId) return undefined;
    let alive = true;
    listTags(organizationId, "categoria")
      .then((res) => {
        if (!alive) return;
        const active = (res.tags ?? []).filter((t) => t.is_active !== false);
        setCategories(active.sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name, "pt-BR")));
      })
      .catch(() => { if (alive) setError("Não foi possível carregar as suas categorias. Recarregue a página para escolher uma."); });
    return () => { alive = false; };
  }, [organizationId]);
  return { categories, error };
}

function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ ...G, fontSize: 13, color: T.red, background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Enviar o extrato
// --------------------------------------------------------------------------------------------

function UploadView({ organizationId, accountId, accountName }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!file) return;
    setSending(true);
    setError("");
    try {
      const draft = await uploadStatement(accountId, organizationId, file);
      navigate({ to: `/accounts/${accountId}/reconcile/${draft.id}` });
    } catch (err) {
      setError(handleApiError(err));
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Importar" serif="extrato" />
      <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
        {accountName ? <>Conta <b>{accountName}</b>. </> : null}
        Envie o extrato da conta corrente em OFX, exportado pelo banco. O Fincla lê os lançamentos e você
        confere cada um antes de qualquer coisa entrar.
      </p>
      <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label htmlFor="statement-file" style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>
          Arquivo do extrato (OFX, até 5 MB)
        </label>
        <input
          id="statement-file"
          type="file"
          accept=".ofx,application/x-ofx"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }}
          style={{ ...G, fontSize: 13 }}
        />
        <ErrorNote>{error}</ErrorNote>
        <div>
          <Btn variant="dark" onClick={send} disabled={!file || sending}>
            <FileUp size={14} aria-hidden="true" style={{ marginRight: 6 }} />
            {sending ? "Enviando…" : "Enviar extrato"}
          </Btn>
        </div>
      </Card>
      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0 }}>
        {NOTHING_CHANGES} O arquivo não fica guardado: só os lançamentos lidos.
      </p>
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

function SummaryStep({ statementImport, concluding, error, onConclude }) {
  const { summary, blockers } = statementImport;
  const rows = [
    ["Lançamentos no extrato", summary.total, "summary-total"],
    ["Serão adicionados", summary.to_create, "summary-to-create"],
    ["Não serão registrados", summary.ignored, "summary-ignored"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px" }}>
          {rows.map(([label, value, testId]) => (
            <div key={testId} style={{ display: "contents" }}>
              <dt style={{ ...G, fontSize: 13, color: T.inkMid }}>{label}</dt>
              <dd data-testid={testId} style={{ ...G, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink, margin: 0, textAlign: "right" }}>{value}</dd>
            </div>
          ))}
        </dl>
        {summary.to_create ? (
          <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "12px 0 0" }}>
            Ao concluir, cada lançamento marcado para adicionar vira uma transação <b>paga na data do banco</b>.
            Os que estão sem categoria vão para Não classificado.
          </p>
        ) : null}
      </Card>
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
  const created = statementImport.entries.filter((e) => e.created_transaction_id != null).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageTitle sans="Conciliar" serif="extrato" />
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...G, fontSize: 18, fontWeight: 800, color: T.green, margin: 0 }}>Conciliação concluída</h2>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, margin: 0 }}>
          {plural(created, "transação adicionada", "transações adicionadas")}
          {accountName ? <> à conta <b>{accountName}</b></> : null}, pagas nas datas do banco.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onOpenAccountTransactions ? (
            <Btn variant="dark" onClick={() => onOpenAccountTransactions(statementImport.account_id, statementPeriod(statementImport))}>Ver transações da conta</Btn>
          ) : null}
          <Btn variant="outGray" onClick={() => navigate({ to: "/accounts" })}>Voltar para Contas</Btn>
        </div>
      </Card>
    </div>
  );
}

function DraftView({ organizationId, accountId, importId, accountName, isMobile, onOpenAccountTransactions }) {
  const { categories, error: categoriesError } = useCategories(organizationId);
  const [statementImport, setStatementImport] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [current, setCurrent] = useState(null);
  const [passed, setPassed] = useState(() => new Set());
  const [concluding, setConcluding] = useState(false);

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
        setCurrent(firstStepWithWork(data.entries));
      })
      .catch((err) => { if (alive) setLoadError(handleApiError(err)); });
    return () => { alive = false; };
  }, [accountId, organizationId, importId]);

  const fallbackLabel = useMemo(
    () => categories.find((c) => c.is_fallback)?.label || "Não classificado",
    [categories],
  );

  const open = (stepKey) => {
    if (current && stepKey !== current) setPassed((prev) => new Set(prev).add(current));
    setCurrent(stepKey);
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
          {NOTHING_CHANGES}
        </p>
      </div>
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

          {current === "new" ? <ErrorNote>{categoriesError}</ErrorNote> : null}
          {current === "new" && stepEntries.map((entry) => (
            <StatementEntryCard
              key={entry.id}
              entry={entry}
              categories={categories}
              fallbackLabel={fallbackLabel}
              isMobile={isMobile}
              onChange={changeEntry}
            />
          ))}
          {current === "outside" && stepEntries.length ? <LeftOutStep entries={stepEntries} /> : null}
          {current === "balance" ? <BalanceStep statementImport={statementImport} /> : null}
          {current === "summary" ? (
            <SummaryStep statementImport={statementImport} concluding={concluding} error={actionError} onConclude={conclude} />
          ) : null}
          {!["new", "balance", "summary", "outside"].includes(current) || (current === "new" && !stepEntries.length) ? (
            <EmptyStep>Nada a fazer aqui: nenhum lançamento deste extrato está neste passo.</EmptyStep>
          ) : null}

          {current !== "summary" ? (
            <div>
              <Btn variant="outGray" onClick={() => open(STEPS[stepIndex + 1].key)}>Continuar</Btn>
            </div>
          ) : null}
        </main>
      </div>
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
        <UploadView organizationId={organizationId} accountId={accountId} accountName={accountName} />
      )}
    </div>
  );
}
