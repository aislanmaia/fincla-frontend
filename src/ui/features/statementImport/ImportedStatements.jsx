// Rascunho e histórico do Conciliar extrato (fincla-api#518; primeira tela aprovada em 2026-11-16).
//
// - `ResumeDraftCard`: "Continue de onde parou", um quadro por rascunho aberto da conta, com o selo
//   da faixa de passos conferidos (a mesma conta da conciliação aberta), a barra, o passo em que parou
//   e, com tudo conferido e nada bloqueando, "Concluir agora" com a confirmação no próprio quadro (os
//   mesmos efeitos de "Revisar e concluir"; nunca `window.confirm`).
// - `DiscardDraftControl`: descartar pede confirmação NA PÁGINA (nunca `window.confirm`).
// - `ImportedStatementsList`: "Extratos importados" da conta, agrupados pelo ano do fim do período,
//   rolando dentro da coluna, com a diferença registrada (`null` vira "—", nunca zero) e "Desfazer"
//   só na concluída mais recente.
import { useEffect, useRef, useState } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, Card } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney, formatMoneySigned } from "../../money/formatMoney.js";
import { handleApiError } from "../../../api/client";
import { concludeStatementImport, discardStatementImport, getStatementBalanceCheck } from "../../../api/statementImports";
import { SummaryEffects } from "./BalanceCheckStep.jsx";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { ErrorNote } from "./StatementImportNotes.jsx";
import { STEPS, blockerText, passedStepsOf, progressBadge, stepProgress } from "./reconciliationSteps.js";
import { summaryCountRows, unclassifiedText } from "./summaryRows.js";

const STATUS = {
  draft: { label: "Em andamento", color: T.blue, bg: T.blueLight },
  concluded: { label: "Concluída", color: T.green, bg: T.greenLight },
  undone: { label: "Desfeita", color: T.inkMid, bg: T.grayLight },
};


/** "2026-11-14T10:20:00" → "14/11/2026". */
function dayOf(timestamp) {
  return timestamp ? bankDateLabel(String(timestamp).slice(0, 10)) : "";
}

/** O período do extrato, ou `null` quando o arquivo não informou. */
export function periodLabel(period) {
  if (!period?.start || !period?.end) return null;
  return `${bankDateLabel(period.start)} a ${bankDateLabel(period.end)}`;
}

function addedLabel(count, status) {
  if (status === "draft") return plural(count, "a adicionar", "a adicionar");
  if (status === "undone") return plural(count, "adicionado e apagado ao desfazer", "adicionados e apagados ao desfazer");
  return plural(count, "adicionado", "adicionados");
}

/** As contagens de uma importação, no tempo verbal do estado dela. */
export function countsLabel(item) {
  const { summary, status } = item;
  const parts = [plural(summary.total, "lançamento", "lançamentos")];
  // Com zero, a contagem de adicionados não aparece (BUG-03): "0 adicionados" não diz nada.
  if (summary.to_create) parts.push(addedLabel(summary.to_create, status));
  if (summary.grouped) parts.push(`${plural(summary.grouped, "somado", "somados")} em ${plural(summary.groups, "lançamento", "lançamentos")}`);
  if (summary.ignored) parts.push(plural(summary.ignored, "não registrado", "não registrados"));
  if (status === "draft" && summary.unanswered) parts.push(plural(summary.unanswered, "sem resposta", "sem resposta"));
  return parts.join(" · ");
}

function StatusPill({ status }) {
  const tone = STATUS[status] ?? STATUS.undone;
  return (
    <span data-testid="import-status" style={{ ...G, fontSize: 11, fontWeight: 700, color: tone.color, background: tone.bg, borderRadius: 9999, padding: "2px 9px", whiteSpace: "nowrap" }}>
      {tone.label}
    </span>
  );
}

export function DiscardDraftControl({ organizationId, accountId, importId, onDiscarded, label = "Descartar rascunho" }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // O foco vai para a confirmação ao abrir e volta a "Descartar" ao manter o rascunho (G3-6).
  const askRef = useRef(null);
  const openRef = useRef(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (asking) askRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      openRef.current?.focus();
    }
  }, [asking]);

  const discard = async () => {
    setBusy(true);
    setError("");
    try {
      await discardStatementImport(accountId, organizationId, importId);
      onDiscarded?.(importId);
    } catch (err) {
      setError(handleApiError(err));
      setBusy(false);
    }
  };

  if (!asking) {
    return <Btn ref={openRef} variant="outRed" small onClick={() => setAsking(true)}>{label}</Btn>;
  }
  return (
    <div ref={askRef} tabIndex={-1} role="group" aria-label="Confirmar descarte do rascunho" style={{ ...G, outline: "none", flexBasis: "100%", background: T.redLight, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 13, color: T.ink, margin: 0 }}>
        <b>Descartar esta conciliação?</b> As respostas que você deu serão apagadas e não dá para recuperar.
        Nada muda nas suas transações.
      </p>
      {error ? <p role="alert" style={{ fontSize: 13, color: T.red, margin: 0 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="outRed" small onClick={discard} disabled={busy}>{busy ? "Descartando…" : "Sim, descartar"}</Btn>
        <Btn variant="outGray" small onClick={() => { returnFocus.current = true; setAsking(false); setError(""); }} disabled={busy}>Manter rascunho</Btn>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Continue de onde parou
// --------------------------------------------------------------------------------------------

const BLUE_TONE = { color: T.blue, bg: T.blueLight, bar: T.blue };
const GREEN_TONE = { color: T.green, bg: T.greenLight, bar: T.green };

/**
 * O progresso do quadro, em PASSOS CONFERIDOS (decisão de 2026-11-16, G3): a mesma conta e a mesma
 * função do "Seu progresso: N de 8 passos conferidos" da conciliação aberta, sobre o detalhe do
 * rascunho. "Concluir agora" só quando todos os passos antes de "Revisar e concluir" foram
 * conferidos e o servidor diz que dá para concluir.
 */
export function draftProgress(statementImport) {
  const progress = stepProgress(statementImport, passedStepsOf(statementImport));
  const { badge, ready } = progressBadge(progress, statementImport.can_conclude);
  return {
    ...progress,
    badge,
    ready,
    // Pronto: o único passo que falta é o próprio "Revisar e concluir" (nunca conta antes de concluir);
    // dizê-lo evita "Tudo conferido" ao lado de "7 de 8" (G4, observação).
    count: `${progress.done.toLocaleString("pt-BR")} de ${plural(progress.total, "passo conferido", "passos conferidos")}${ready ? " · falta só Revisar e concluir" : ""}`,
    tone: ready ? GREEN_TONE : BLUE_TONE,
  };
}

/** A diferença de saldo que fica, a mesma da conferência: `null` = o arquivo não informa saldo → "—", nunca zero. */
function differenceLabel(check) {
  if (check.final_difference === null) return "—";
  return check.final_difference === 0 ? formatMoney(0, check.currency) : formatMoneySigned(check.final_difference, check.currency);
}

/**
 * A confirmação de "Concluir agora", no próprio quadro: os MESMOS efeitos de "Revisar e concluir"
 * (as contagens de `summaryCountRows`, os selos de `SummaryEffects` com a conferência de saldo, Não
 * classificado e a diferença registrada), compactos. Contagem zero não vira linha. Ao abrir, o foco
 * vem para a confirmação.
 */
function ConcludeConfirm({ organizationId, draft, detail, busy, onConfirm, onCancel, onOpen }) {
  const ref = useRef(null);
  const [check, setCheck] = useState(null);
  const [checkError, setCheckError] = useState("");
  const period = periodLabel(draft.period);
  const unclassified = unclassifiedText(detail.summary);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    let alive = true;
    getStatementBalanceCheck(draft.account_id, organizationId, draft.id)
      .then((data) => { if (alive) setCheck(data); })
      .catch((err) => { if (alive) setCheckError(handleApiError(err)); });
    return () => { alive = false; };
  }, [draft.account_id, draft.id, organizationId]);

  return (
    <div ref={ref} tabIndex={-1} role="group" aria-label="Confirmar a conclusão" style={{ ...G, flexBasis: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, outline: "none" }}>
      <b style={{ fontSize: 14, color: T.ink }}>{period ? <>Concluir a conciliação de <span style={NUM}>{period}</span>?</> : "Concluir esta conciliação?"}</b>
      <ul data-testid="conclude-counts" style={{ ...NUM, margin: 0, paddingLeft: 18, fontSize: 13, color: T.inkMid, lineHeight: 1.7 }}>
        {summaryCountRows(detail).filter(([, value]) => value).map(([label, value, testId, note]) => (
          <li key={testId}>{label}: <b style={{ color: T.ink }}>{value.toLocaleString("pt-BR")}</b>{note ? ` · ${note}` : null}</li>
        ))}
        {unclassified ? <li>{unclassified}</li> : null}
        {check ? <li>Diferença de saldo que fica registrada: <b style={{ color: T.ink }}>{differenceLabel(check)}</b>.</li> : null}
      </ul>
      {check ? <SummaryEffects entries={detail.entries} check={check} /> : null}
      {!check && !checkError ? <span style={{ fontSize: 12, color: T.inkLight }}>Calculando o que muda ao concluir…</span> : null}
      {checkError ? <ErrorNote>{checkError}</ErrorNote> : null}
      <span style={{ fontSize: 12, color: T.inkLight }}>Dá para desfazer depois, em Extratos importados.</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="green" onClick={onConfirm} disabled={busy || !check}>{busy ? "Concluindo…" : "Sim, concluir"}</Btn>
        <Btn variant="outGray" onClick={onCancel} disabled={busy}>Agora não</Btn>
        <Btn variant="outGray" onClick={onOpen} disabled={busy}>Abrir conciliação</Btn>
      </div>
    </div>
  );
}

/**
 * Um quadro por rascunho aberto. `detail` é o rascunho inteiro (o mesmo do detalhe; `null` se não
 * deu para ler): o progresso e o "Concluir agora" saem dele. `onConcluded`/`onRefused` recarregam a
 * lista (promessa): o botão fica desabilitado do clique até a lista recarregada chegar.
 */
export function ResumeDraftCard({ organizationId, draft, detail, onContinue, onDiscarded, onConcluded, onRefused }) {
  const [confirming, setConfirming] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [error, setError] = useState("");
  const concludeRef = useRef(null);
  const returnFocus = useRef(false);
  const progress = detail ? draftProgress(detail) : null;
  const period = periodLabel(draft.period);
  const step = STEPS.find((s) => s.key === draft.current_step);
  const titleId = `resume-draft-${draft.id}`;

  // "Agora não" devolve o foco a "Concluir agora", que volta a existir depois de fechar a confirmação.
  useEffect(() => {
    if (!confirming && returnFocus.current) {
      returnFocus.current = false;
      concludeRef.current?.focus();
    }
  }, [confirming]);

  const conclude = async () => {
    setConcluding(true);
    setError("");
    try {
      await concludeStatementImport(draft.account_id, organizationId, draft.id);
      await onConcluded?.(draft);
    } catch (err) {
      // O servidor recusou (outra aba mudou o rascunho, por exemplo): a lista e o quadro recarregam.
      setError(handleApiError(err));
      setConfirming(false);
      await onRefused?.(draft);
    } finally {
      setConcluding(false);
    }
  };

  const blockers = detail && !detail.can_conclude && detail.blockers.length && (progress.allPassed || !detail.summary.unanswered)
    ? detail.blockers.map(blockerText).join(" ")
    : "";

  return (
    <section data-testid="resume-draft" aria-labelledby={titleId} style={{ ...G, background: T.surface, border: `2px solid ${T.blue}`, borderRadius: 16, padding: "20px 22px", display: "flex", flexWrap: "wrap", gap: "16px 32px", alignItems: "center" }}>
      <div style={{ flex: "2 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {progress ? (
          <span data-testid="resume-badge" style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 700, color: progress.tone.color, background: progress.tone.bg, borderRadius: 9999, padding: "3px 10px" }}>
            {progress.badge}
          </span>
        ) : null}
        <h2 id={titleId} style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: 0 }}>Continue de onde parou</h2>
        {period || step ? (
          <p style={{ fontSize: 14, color: T.inkMid, margin: 0 }}>
            {period ? <>Extrato de <b style={NUM}>{period}</b></> : null}
            {period && step ? " · " : null}
            {step ? <>você parou em <b>{step.title}</b></> : null}
          </p>
        ) : null}
        {progress ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 440 }}>
            <div
              role="progressbar"
              aria-label="Passos conferidos"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              style={{ height: 6, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}
            >
              <div style={{ height: 6, width: `${Math.round((progress.done / progress.total) * 100)}%`, background: progress.tone.bar, borderRadius: 99, transition: "width .3s" }} />
            </div>
            <span data-testid="resume-count" style={{ ...NUM, fontSize: 12, color: T.inkMid }}>{progress.count}</span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: T.inkLight }}>Não deu para ler o progresso agora. Abra a conciliação para ver onde parou.</span>
        )}
        {blockers ? <span data-testid="resume-blockers" style={{ fontSize: 12, color: T.amber }}>{blockers}</span> : null}
        <span style={{ fontSize: 12, color: T.inkLight }}>
          Suas respostas estão salvas.
          {draft.expires_at ? <> Se ficar parada, é descartada em <span style={NUM}>{dayOf(draft.expires_at)}</span>.</> : null}
        </span>
      </div>
      {!confirming ? (
        <div style={{ flex: "0 1 auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {progress?.ready ? (
            <>
              <Btn ref={concludeRef} variant="green" disabled={concluding} onClick={() => { setError(""); setConfirming(true); }}>Concluir agora</Btn>
              <Btn variant="outGray" onClick={() => onContinue(draft)}>Abrir conciliação</Btn>
            </>
          ) : (
            <Btn variant="dark" onClick={() => onContinue(draft)}>Continuar conciliação</Btn>
          )}
          <DiscardDraftControl organizationId={organizationId} accountId={draft.account_id} importId={draft.id} onDiscarded={onDiscarded} label="Descartar" />
        </div>
      ) : (
        <ConcludeConfirm
          organizationId={organizationId}
          draft={draft}
          detail={detail}
          busy={concluding}
          onConfirm={conclude}
          onCancel={() => { returnFocus.current = true; setConfirming(false); setError(""); }}
          onOpen={() => onContinue(draft)}
        />
      )}
      {error ? <div style={{ flexBasis: "100%" }}><ErrorNote>{error}</ErrorNote></div> : null}
    </section>
  );
}

// --------------------------------------------------------------------------------------------
// Extratos importados
// --------------------------------------------------------------------------------------------

/** "2026-12-31" → "2027-01-01", em aritmética de calendário (UTC só para contar dias, nunca o fuso local). */
function nextDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/**
 * A dica do envio: até onde vai a conciliação concluída (que não foi desfeita) de MAIOR fim de período
 * e o dia em que um extrato novo continua dela (G3: concluir setembro depois de outubro não faz a dica
 * voltar para setembro). `null` sem conciliação concluída com o fim do período.
 */
export function continueTip(items) {
  const concluded = items
    .filter((i) => i.status === "concluded" && i.period?.end)
    .sort((a, b) => b.period.end.localeCompare(a.period.end))[0];
  if (!concluded) return null;
  const from = nextDay(concluded.period.end);
  const [, m, d] = from.split("-");
  return `Dica: a última conciliação foi até ${bankDateLabel(concluded.period.end)}. Um extrato a partir de ${d}/${m} continua de onde ela parou.`;
}

/** O dia que ordena e agrupa uma importação: o fim do período; sem ele, o dia em que foi importada. */
const sortDay = (item) => item.period?.end ?? String(item.created_at ?? "").slice(0, 10);

/** Os rascunhos no topo; o resto em grupos por ano (do mais novo), cada grupo do fim mais recente. */
export function groupImports(items) {
  const drafts = items.filter((i) => i.status === "draft");
  const rest = items
    .filter((i) => i.status !== "draft")
    .slice()
    .sort((a, b) => sortDay(b).localeCompare(sortDay(a)) || String(b.created_at).localeCompare(String(a.created_at)));
  const years = [];
  for (const item of rest) {
    const year = sortDay(item).slice(0, 4);
    const group = years.at(-1);
    if (group && group.year === year) group.items.push(item);
    else years.push({ year, items: [item] });
  }
  return { drafts, years };
}

function ImportedStatementRow({ item, first, onOpen, onUndo }) {
  const period = periodLabel(item.period);
  // `null` = não registrada (antes da conferência de saldo, fincla-api#514): travessão, nunca zero.
  // Zero sem sinal, como na confirmação de concluir (G4 BUG-01); `null` = não registrada → "—".
  const difference = item.final_difference == null
    ? "—"
    : Number(item.final_difference) === 0
      ? formatMoney(0, item.final_difference_currency)
      : formatMoneySigned(item.final_difference, item.final_difference_currency) ?? "—";
  return (
    <li data-testid="imported-statement" style={{ ...G, display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderTop: first ? "none" : `1px solid ${T.grayLight}`, fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b style={{ ...NUM, color: T.ink }}>{period ?? "Período não informado"}</b>
        <StatusPill status={item.status} />
      </span>
      <span style={{ ...NUM, fontSize: 12, color: T.inkMid }}>{countsLabel(item)}</span>
      {item.status !== "draft" ? (
        <span data-testid="import-difference" style={{ fontSize: 12, color: T.inkLight }}>
          Diferença de saldo registrada: <b style={{ ...NUM, color: T.ink }}>{difference}</b>
        </span>
      ) : null}
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        <Btn variant="outGray" small onClick={() => onOpen(item)}>
          {item.status === "draft" ? "Continuar conciliação" : "Ver conciliação"}
        </Btn>
        {/* Só a concluída mais recente da conta pode ser desfeita. */}
        {item.latest_concluded ? (
          <Btn variant="outRed" small aria-label="Desfazer importação" onClick={() => onUndo(item)}>Desfazer</Btn>
        ) : null}
      </span>
    </li>
  );
}

export function ImportedStatementsList({ items, onOpen, onUndo, isMobile = false }) {
  const { drafts, years } = groupImports(items);
  return (
    <section
      aria-labelledby="imported-statements-title"
      style={{
        ...G, flex: isMobile ? "1 1 100%" : "1 1 300px", maxWidth: isMobile ? "none" : 360, minWidth: 0, minHeight: isMobile ? 0 : 280,
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 id="imported-statements-title" style={{ fontSize: 12, fontWeight: 700, color: T.inkMid, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Extratos importados
        </h2>
        {items.length ? <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>{items.length}</span> : null}
      </div>
      {/* A lista mede o próprio conteúdo até um teto e só então rola dentro da coluna. No computador é
          ela que dá a altura da linha e a área de soltar estica junto; presa à altura da área, uma
          lista curta ficava cortada ao lado da área compacta (G4 BUG-03). */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <div
          data-testid="imported-statements-scroll"
          className="fincla-scroll"
          style={{ maxHeight: isMobile ? 420 : 480, overflowY: "auto", padding: "0 16px 8px" }}
        >
          {items.length ? (
            <>
              {drafts.length ? (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {drafts.map((item, index) => (
                    <ImportedStatementRow key={item.id} item={item} first={index === 0} onOpen={onOpen} onUndo={onUndo} />
                  ))}
                </ul>
              ) : null}
              {years.map((group) => (
                <div key={group.year}>
                  <h3 style={{ position: "sticky", top: 0, zIndex: 1, margin: 0, padding: "10px 0 6px", background: T.surface, fontSize: 12, fontWeight: 700, color: T.inkLight }}>
                    {group.year}
                  </h3>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {group.items.map((item, index) => (
                      <ImportedStatementRow key={item.id} item={item} first={index === 0} onOpen={onOpen} onUndo={onUndo} />
                    ))}
                  </ul>
                </div>
              ))}
            </>
          ) : (
            <p style={{ fontSize: 13, color: T.inkLight, margin: "12px 0" }}>Nenhum extrato importado nesta conta ainda.</p>
          )}
        </div>
      </div>
    </section>
  );
}
