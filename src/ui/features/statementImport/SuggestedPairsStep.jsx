// Passo "Confirmar lançamentos encontrados" (fincla-api#510).
//
// Cada lançamento do banco que o Fincla achou já registrado vem como um par: à esquerda o banco,
// à direita a transação do Fincla com o selo "Sugerido pelo Fincla", ligados por uma linha. A
// sugestão já vem respondida "Sim, é esta" e falta a pessoa confirmar. Responder (ou "Confirmar
// os N de uma vez") minimiza o cartão numa linha que continua visível, com "Alterar" e "Desfazer
// escolha": nada some sem um jeito de voltar. Nada muda no Fincla antes de concluir.
import { memo, useEffect, useRef } from "react";
import { Ban, Check, ChevronRight, Link2, Plus, Sparkles } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";

/** "Confirmar os 3 de uma vez"; com uma sugestão só, "de uma vez" não cabe. */
export function confirmAllLabel(count) {
  return count === 1 ? "Confirmar este lançamento" : `Confirmar os ${count.toLocaleString("pt-BR")} de uma vez`;
}
import { SKIP_BG, SkipBadge, StatementEntryCard, bankDateLabel } from "./StatementEntryCard.jsx";
import { unconfirmedSuggestions } from "./reconciliationSteps.js";
import { LINK } from "./StatementImportNotes.jsx";
import { FinclaMatchBox, dayOf, matchTitle, paidWord } from "./FinclaMatchBox.jsx";
import {
  CurrentEntryFrame, EntryQueueHeader, InlineFields, ROW_CLICKABLE, openOnRowClick, useCompact, useStableCallback,
} from "./entryQueue.jsx";

const BOX = { border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1 };
const BOX_LABEL = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 };

const ANSWERS = [
  { value: "pair", label: "Sim, é esta", tone: T.blue },
  { value: "create", label: "Não, adicionar agora", tone: T.green },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];


export function BankSide({ entry, dateDiffers }) {
  const moneyIn = entry.amount > 0;
  const compact = useCompact();
  if (compact) {
    return (
      <section data-testid="bank-side" style={{ ...BOX, background: T.bg, padding: "8px 10px" }}>
        <div style={{ ...BOX_LABEL, marginBottom: 4 }}>No extrato do banco</div>
        <InlineFields
          testId="bank-inline"
          items={[
            ["Data", <span key="d" style={{ ...NUM, color: dateDiffers ? T.amber : T.ink, fontWeight: dateDiffers ? 700 : 400 }}>{bankDateLabel(entry.date)}</span>],
            ["Descrição", <b key="n">{entry.bank_description}</b>],
            ["Valor", <b key="v" style={{ ...NUM, color: moneyIn ? T.green : T.ink }}>{formatMoney(entry.amount, entry.currency)}</b>],
          ]}
        />
      </section>
    );
  }
  return (
    <section data-testid="bank-side" style={{ ...BOX, background: T.bg }}>
      <div style={BOX_LABEL}>No extrato do banco</div>
      <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{entry.bank_description}</div>
      <div style={{ ...G, ...NUM, fontSize: 12, color: dateDiffers ? T.amber : T.inkLight, fontWeight: dateDiffers ? 700 : 400, marginTop: 6 }}>
        {bankDateLabel(entry.date)}
      </div>
      <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 700, marginTop: 6, color: moneyIn ? T.green : T.ink }}>
        {formatMoney(entry.amount, entry.currency)}
      </div>
    </section>
  );
}

/** A linha entre o banco e o Fincla: ligados (par), nova transação, ou nada. */
export function Connector({ answer, isMobile }) {
  const look = {
    pair: { color: T.blue, line: "solid", Icon: Link2, label: "ligado" },
    create: { color: T.green, line: "dashed", Icon: Plus, label: "nova transação" },
    ignore: { color: T.inkFaint, line: "none", Icon: Ban, label: "não registrar" },
  }[answer] ?? { color: T.amber, line: "dotted", Icon: Link2, label: "sem resposta" };
  const { Icon } = look;
  return (
    <div
      data-testid="pair-connector"
      data-link={answer ?? "none"}
      aria-hidden="true"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "stretch", minWidth: isMobile ? 0 : 36, minHeight: 32 }}
    >
      <span style={isMobile
        ? { position: "absolute", top: 4, bottom: 4, left: "50%", borderLeft: look.line === "none" ? "none" : `2px ${look.line} ${look.color}` }
        : { position: "absolute", left: 2, right: 2, top: "50%", borderTop: look.line === "none" ? "none" : `2px ${look.line} ${look.color}` }}
      />
      <span style={{ position: "relative", width: 28, height: 28, borderRadius: 9999, display: "grid", placeItems: "center", background: T.surface, border: `1.5px solid ${look.color}`, color: look.color }}>
        <Icon size={14} />
      </span>
    </div>
  );
}

/**
 * A transação (ou transferência, fincla-api#511) do Fincla como ela está hoje, com o selo e o que
 * muda ao concluir.
 */
function FinclaSide({ entry, accountName }) {
  const match = entry.fincla_match;
  if (!match) {
    return (
      <section style={{ ...BOX, background: T.grayLight }}>
        <div style={BOX_LABEL}>No Fincla</div>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          A transação sugerida não existe mais no Fincla. Escolha “Não, adicionar agora” ou “Não registrar”.
        </p>
      </section>
    );
  }
  const suggested = match.kind === "transfer"
    ? match.transfer_id === entry.suggested_transfer_id
    : match.transaction_id === entry.suggested_transaction_id;
  return (
    <FinclaMatchBox entry={entry} match={match} accountName={accountName} suggested={suggested} consequences={entry.answer === "pair"} />
  );
}

/** "Não registrar" com o selo e o fundo listrado próprios, os mesmos do passo de lançamentos novos. */
export function IgnoredSide() {
  return (
    <section data-testid="pair-ignored-side" style={{ ...BOX, background: SKIP_BG }}>
      <div style={BOX_LABEL}>
        No Fincla <SkipBadge />
      </div>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
        Este lançamento não entra no Fincla. O saldo do Fincla fica sem este valor, e a diferença aparece na conferência de saldo.
      </p>
    </section>
  );
}

/** Em uma linha, o que acontece ao concluir a conciliação. */
function outcomeText(entry) {
  const match = entry.fincla_match;
  if (entry.answer === "pair" && match?.kind === "transfer") {
    return <>Ao concluir a conciliação: nada muda em <b>{matchTitle(entry, match)}</b>, que já está no Fincla; nenhuma transação é criada.</>;
  }
  if (entry.answer === "pair" && match) {
    return <>Ao concluir a conciliação: <b>{match.description}</b> {paidWord(entry)} em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco). Descrição, data, categoria e etiquetas continuam como estão.</>;
  }
  if (entry.answer === "create") {
    return <>Ao concluir a conciliação: será adicionada <b>“{entry.description || "(sem descrição)"}”</b>, paga na data do banco. A transação sugerida fica como está.</>;
  }
  if (entry.answer === "ignore") return <>Este lançamento não entra no Fincla. Ele aparece na conferência de saldo.</>;
  return null;
}

export function StatusBadge({ entry }) {
  if (entry.answer === "pair" && !entry.confirmed) {
    return <Badge color={T.blue} bg={T.blueLight}><Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Sugerido · falta confirmar</Badge>;
  }
  if (entry.answer === "pair") return <Badge color={T.blue} bg={T.blueLight}><Link2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Sim, já está no Fincla</Badge>;
  if (entry.answer === "create") return <Badge color={T.green} bg={T.greenLight}><Plus size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Adicionar agora</Badge>;
  return <SkipBadge />;
}

function AnswerButtons({ entry, busy, onAnswer }) {
  const label = "Este lançamento do banco já está no Fincla?";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        {ANSWERS.map((a, index) => {
          const pressed = entry.answer === a.value;
          const unavailable = a.value === "pair" && !entry.fincla_match;
          return (
            <button
              key={a.value}
              type="button"
              aria-pressed={pressed}
              disabled={busy || unavailable}
              onClick={() => onAnswer(entry, a.value)}
              style={{
                ...G, minHeight: 32, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: busy || unavailable ? "not-allowed" : "pointer",
                border: 0, borderRight: index < ANSWERS.length - 1 ? `1px solid ${T.border}` : 0,
                background: pressed ? a.tone : "transparent", color: pressed ? "#fff" : T.inkLight,
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UndoChoiceButton({ entry, onUndoChoice }) {
  return (
    <button type="button" onClick={() => onUndoChoice(entry)} style={{ ...LINK, fontSize: 12, color: T.inkMid }}>
      Desfazer escolha
    </button>
  );
}

/** O cartão aberto de um par sugerido. */
function PairCard({ entry, isMobile, busy, canUndo, categories, details, fallbackLabel, accountName, onAnswer, onChange, onUndoChoice, onMinimize }) {
  const dateDiffers = entry.answer === "pair" && Boolean(entry.fincla_match?.differences.includes("date"));
  const outcome = outcomeText(entry);
  let right;
  if (entry.answer === "create") {
    right = <StatementEntryCard entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange} embedded />;
  } else if (entry.answer === "ignore") {
    right = <IgnoredSide />;
  } else {
    right = <FinclaSide entry={entry} accountName={accountName} />;
  }
  return (
    <article
      data-testid="pair-card"
      aria-label={`Lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.answer === "pair" && !entry.confirmed ? T.blue : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <StatusBadge entry={entry} />
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} /> : null}
        {onMinimize ? <Btn variant="outGray" small onClick={() => onMinimize(entry)}>Minimizar</Btn> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <BankSide entry={entry} dateDiffers={dateDiffers} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{right}</div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerButtons entry={entry} busy={busy} onAnswer={onAnswer} />
      </footer>
      {outcome ? (
        <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>{outcome}
        </p>
      ) : null}
    </article>
  );
}

function rowSummary(entry) {
  const match = entry.fincla_match;
  if (entry.answer === "pair" && match?.kind === "transfer") return <>Sim, é <b>{matchTitle(entry, match)}</b> · {bankDateLabel(match.day)}</>;
  if (entry.answer === "pair" && match) return <>Sim, é <b>{match.description}</b> · {bankDateLabel(dayOf(match.date))} · {paidWord(entry)} em {bankDateLabel(entry.date)}</>;
  if (entry.answer === "create") return <>Adicionar ao Fincla: <b>{entry.description || "(sem descrição)"}</b></>;
  return <span style={{ color: T.inkLight }}>Fica fora do Fincla</span>;
}

/**
 * Um par minimizado numa linha que continua visível. Clicar em qualquer ponto da linha (ou no
 * "Alterar" do começo dela) a reabre como o cartão atual.
 */
const PairRow = memo(function PairRowView({ entry, canUndo, focus = false, onOpen, onUndoChoice }) {
  // Quando a linha acaba de tomar o lugar do cartão, o foco vem para o "Alterar" dela (o botão
  // que a pessoa apertou saiu da tela).
  const alterRef = useRef(null);
  useEffect(() => { if (focus) alterRef.current?.focus(); }, [focus]);
  return (
    <div data-testid="pair-row" onClick={openOnRowClick(() => onOpen(entry))} style={{ ...ROW_CLICKABLE, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderBottom: `1px solid ${T.border}`, background: entry.answer === "ignore" ? SKIP_BG : "transparent", ...G, fontSize: 12, color: T.inkMid }}>
      <button
        ref={alterRef}
        type="button"
        onClick={() => onOpen(entry)}
        aria-label={`Alterar o lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
        style={{ ...LINK, fontSize: 12, color: T.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}
      >
        <ChevronRight size={13} aria-hidden="true" />Alterar
      </button>
      <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, color: entry.amount > 0 ? T.green : T.ink }}>{formatMoney(entry.amount, entry.currency)}</span>
      <StatusBadge entry={entry} />
      <span style={{ flex: 1, minWidth: 160 }}>{rowSummary(entry)}</span>
      {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} /> : null}
    </div>
  );
});

/**
 * O passo inteiro (lista do fincla-api#517): só o lançamento atual (`queue.currentId`) fica aberto;
 * os outros são linhas. `history` guarda, por lançamento, as respostas anteriores para "Desfazer
 * escolha"; `lastBulk` é a última confirmação em lote, com a sua barra de desfazer.
 */
export function SuggestedPairsStep({
  entries,
  queue,
  view = "detailed",
  onViewChange = null,
  isMobile,
  busy,
  categories,
  details = [],
  fallbackLabel,
  accountName = "",
  history,
  lastBulk,
  onAnswer,
  onChange,
  onUndoChoice,
  onConfirmAll,
  onUndoConfirmAll,
}) {
  const unconfirmed = unconfirmedSuggestions(entries);
  const openRow = useStableCallback((entry) => queue.open(entry.id));
  const undoChoice = useStableCallback(onUndoChoice);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <EntryQueueHeader queue={queue} view={view} onViewChange={onViewChange} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...G, ...NUM, fontSize: 13, color: T.inkMid }}>{plural(entries.length, "lançamento encontrado", "lançamentos encontrados")}</span>
        {unconfirmed.length ? (
          <Btn variant="dark" small disabled={busy} onClick={() => onConfirmAll(unconfirmed.map((e) => e.id))}>
            <Check size={13} aria-hidden="true" /> {confirmAllLabel(unconfirmed.length)}
          </Btn>
        ) : (
          <span style={{ ...G, fontSize: 12, color: T.green, fontWeight: 600 }}>Todos conferidos</span>
        )}
      </div>
      {lastBulk ? (
        <div role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Check size={14} aria-hidden="true" style={{ color: T.green }} />
          <span style={{ flex: 1 }}>{plural(lastBulk.length, "lançamento confirmado", "lançamentos confirmados")}</span>
          <button type="button" onClick={onUndoConfirmAll} disabled={busy} style={{ ...LINK, color: T.ink }}>Desfazer</button>
        </div>
      ) : null}
      {entries.filter(queue.shown).map((entry) => (entry.id === queue.currentId ? (
        <CurrentEntryFrame key={entry.id} queue={queue} entry={entry}>
          <PairCard
            entry={entry}
            isMobile={isMobile}
            busy={busy}
            canUndo={Boolean(history[entry.id]?.length)}
            categories={categories}
            details={details}
            fallbackLabel={fallbackLabel}
            accountName={accountName}
            onAnswer={onAnswer}
            onChange={onChange}
            onUndoChoice={onUndoChoice}
            onMinimize={(e) => queue.close(e.id)}
          />
        </CurrentEntryFrame>
      ) : (
        <div key={entry.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <PairRow entry={entry} canUndo={Boolean(history[entry.id]?.length)} focus={queue.rowFocusId === entry.id} onOpen={openRow} onUndoChoice={undoChoice} />
        </div>
      )))}
    </div>
  );
}
