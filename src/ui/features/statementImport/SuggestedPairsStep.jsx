// Passo "Confirmar lançamentos encontrados" (fincla-api#510).
//
// Cada lançamento do banco que o Fincla achou já registrado vem como um par: à esquerda o banco,
// à direita a transação do Fincla com o selo "Sugerido pelo Fincla", ligados por uma linha. A
// sugestão já vem respondida "Sim, é esta" e falta a pessoa confirmar. Responder (ou "Confirmar
// os N de uma vez") minimiza o cartão numa linha que continua visível, com "Alterar" e "Desfazer
// escolha": nada some sem um jeito de voltar. Nada muda no Fincla antes de concluir.
import { memo, useEffect, useRef } from "react";
import { Ban, Check, ChevronRight, Link2, Plus, Sparkles } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";

/** "Confirmar os 3 de uma vez"; com uma sugestão só, "de uma vez" não cabe. */
export function confirmAllLabel(count) {
  return count === 1 ? "Confirmar este lançamento" : `Confirmar os ${count.toLocaleString("pt-BR")} de uma vez`;
}
import {
  CONFIRM_BLOCKED_NOTE, ConfirmAnswerButton, SKIP_BG, SkipBadge, StatementEntryCard, bankDateLabel, useDescriptionDraft,
} from "./StatementEntryCard.jsx";
import { unconfirmedSuggestions } from "./reconciliationSteps.js";
import { FinclaMatchBox, dayOf, matchTitle, paidWord } from "./FinclaMatchBox.jsx";
import {
  ConferidoBadge, CurrentEntryFrame, EntryQueueHeader, EntrySlot, InlineFields, ROW_CLICKABLE, answerTone, isAnswered, openOnRowClick, useCompact,
  useStableCallback,
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
  // "Não registrar": o fundo listrado, o mesmo do lado do Fincla e da linha minimizada.
  const background = entry.answer === "ignore" ? SKIP_BG : T.bg;
  if (compact) {
    return (
      <section data-testid="bank-side" style={{ ...BOX, background, padding: "8px 10px" }}>
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
    <section data-testid="bank-side" style={{ ...BOX, background }}>
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

/** A sugestão do Fincla era esta transação/transferência? (selo "Sugerido pelo Fincla"). */
const isSuggestedMatch = (entry, match) => (match.kind === "transfer"
  ? match.transfer_id === entry.suggested_transfer_id
  : match.transaction_id === entry.suggested_transaction_id);

/**
 * A transação (ou transferência, fincla-api#511) do Fincla como ela está hoje, com o selo e o que
 * muda ao concluir.
 */
function FinclaSide({ entry, accountName, onConfirm = null }) {
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
  const suggested = isSuggestedMatch(entry, match);
  return (
    <FinclaMatchBox
      entry={entry}
      match={match}
      accountName={accountName}
      suggested={suggested}
      consequences={entry.answer === "pair"}
      onConfirm={entry.answer === "pair" ? onConfirm : null}
    />
  );
}

/** O que acontece com o que estava no lado do Fincla quando a resposta é "Não registrar". */
export function skipNoteText(count) {
  return count > 1
    ? "Continuam no Fincla como estão, sem mudança. Este lançamento do banco não entra no Fincla, e a diferença aparece na conferência de saldo."
    : "Continua no Fincla como está, sem mudança. Este lançamento do banco não entra no Fincla, e a diferença aparece na conferência de saldo.";
}

/**
 * "Não registrar" (decisão do Owner em fincla-api#507): o lado do Fincla não some. Continua
 * mostrando o que estava lá (`matches`: a sugestão, ou as opções de uma dúvida), sem clique, com o
 * fundo listrado do lado do banco e a nota "Fica de fora". Sem nada para mostrar, só o aviso.
 */
export function IgnoredSide({ entry = null, matches = [], accountName = "", suggestedOf = () => false }) {
  if (!entry || !matches.length) {
    return (
      <section data-testid="pair-ignored-side" style={{ ...BOX, background: SKIP_BG, borderColor: T.inkFaint }}>
        <div style={BOX_LABEL}>
          No Fincla <SkipBadge />
        </div>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          Este lançamento não entra no Fincla. O saldo do Fincla fica sem este valor, e a diferença aparece na conferência de saldo.
        </p>
      </section>
    );
  }
  return (
    <div data-testid="pair-ignored-side" style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      {matches.map((match, index) => (
        <FinclaMatchBox
          key={`${match.kind}-${match.transaction_id ?? match.transfer_id}`}
          entry={entry}
          match={match}
          accountName={accountName}
          suggested={suggestedOf(match)}
          skipNote={index === matches.length - 1 ? skipNoteText(matches.length) : true}
        />
      ))}
    </div>
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

/**
 * A sugestão do Fincla sem nenhuma mudança: "Sim, é esta" já vem marcado e falta confirmar. Só aí
 * (e no formulário do item novo) aparece o Confirmar ao lado das respostas.
 */
export const untouchedSuggestion = (entry) => entry.answer === "pair" && !entry.confirmed && Boolean(entry.fincla_match);

function AnswerButtons({ entry, isMobile, busy, desc, onAnswer, onChange, onConfirm }) {
  const label = "Este lançamento do banco já está no Fincla?";
  let confirm = null;
  if (untouchedSuggestion(entry)) {
    confirm = <ConfirmAnswerButton label="Confirmar sugestão" disabled={busy} touch={isMobile} onConfirm={() => onAnswer(entry, "pair")} />;
  } else if (entry.answer === "create" && onConfirm) {
    confirm = (
      <ConfirmAnswerButton
        disabled={busy || !desc.value.trim()}
        blockedNote={desc.value.trim() ? "" : CONFIRM_BLOCKED_NOTE}
        onConfirm={() => desc.confirm(onConfirm)}
      />
    );
  }
  return (
    <AnswerSegment
      label={label}
      answers={ANSWERS}
      value={entry.answer}
      busy={busy}
      unavailable={(a) => a.value === "pair" && !entry.fincla_match}
      onAnswer={(value) => onAnswer(entry, value)}
      confirm={confirm}
      touch={isMobile}
    />
  );
}

// A fileira de respostas. No celular (`touch`) ela pode quebrar (390 px, 3 respostas): os divisores
// vêm do vão de 1 px sobre o fundo da borda e cada botão cresce até o fim da linha, então nenhuma
// linha termina num divisor solto nem num vão (QA F1). No computador fica como era.
const ANSWER_ROW = { display: "inline-flex", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" };
const TOUCH_ANSWER_ROW = { display: "flex", flexWrap: "wrap", gap: 1, background: T.border, border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden", maxWidth: "100%" };

/**
 * A pergunta e a fileira de respostas de um cartão (a marca da fileira é a faixa que os atalhos e o
 * aviso do rodapé medem), com o Confirmar ao lado quando ele cabe. Comum ao extrato e à fatura.
 * `unavailable(a)` desliga uma resposta; `note` é o motivo escrito embaixo (ex.: fatura já paga).
 * `touch` (celular) dá às respostas a altura de um alvo de toque; no computador ficam com 32 px.
 */
export function AnswerSegment({ label, answers, value, busy, unavailable = () => false, onAnswer, confirm = null, note = null, touch = false }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</span>
      <div role="group" data-answer-row="" aria-label={label} style={touch ? TOUCH_ANSWER_ROW : ANSWER_ROW}>
        {answers.map((a, index) => {
          const pressed = value === a.value;
          const off = unavailable(a);
          return (
            <button
              key={a.value}
              type="button"
              aria-pressed={pressed}
              disabled={busy || off}
              onClick={() => onAnswer(a.value)}
              style={{
                ...G, minHeight: touch ? TOUCH_TARGET : 32, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: busy || off ? "not-allowed" : "pointer",
                border: 0,
                ...(touch
                  ? { flex: "1 1 auto", background: pressed ? a.tone : T.bg }
                  : { borderRight: index < answers.length - 1 ? `1px solid ${T.border}` : 0, background: pressed ? a.tone : "transparent" }),
                color: pressed ? "#fff" : T.inkLight,
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>
      {confirm}
      {note ? <span data-testid="answer-note" style={{ ...G, fontSize: 12, color: T.inkMid, flexBasis: "100%" }}>{note}</span> : null}
    </div>
  );
}

/** "Desfazer escolha": vermelho no cartão; discreto (`inRow`) na linha minimizada, que já é clicável. */
export function UndoChoiceButton({ entry, onUndoChoice, inRow = false, touch = false }) {
  return (
    <Btn variant={inRow ? "ghost" : "outGray"} small onClick={() => onUndoChoice(entry)} style={touch ? { minHeight: TOUCH_TARGET } : undefined}>
      Desfazer escolha
    </Btn>
  );
}

/**
 * O cartão aberto de um par sugerido. `onConfirm` minimiza o cartão (o Confirmar do formulário do
 * item novo); as outras respostas já confirmam e minimizam pela página.
 */
function PairCard({ entry, isMobile, busy, canUndo, categories, details, fallbackLabel, accountName, onAnswer, onChange, onUndoChoice, onMinimize, onConfirm = null }) {
  const dateDiffers = entry.answer === "pair" && Boolean(entry.fincla_match?.differences.includes("date"));
  const outcome = outcomeText(entry);
  const desc = useDescriptionDraft(entry, onChange);
  let right;
  if (entry.answer === "create") {
    right = (
      <StatementEntryCard
        entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange}
        embedded desc={desc}
      />
    );
  } else if (entry.answer === "ignore") {
    const matches = entry.fincla_match ? [entry.fincla_match] : [];
    right = <IgnoredSide entry={entry} matches={matches} accountName={accountName} suggestedOf={(m) => isSuggestedMatch(entry, m)} />;
  } else {
    right = <FinclaSide entry={entry} accountName={accountName} onConfirm={busy ? null : () => onAnswer(entry, "pair")} />;
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
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} touch={isMobile} /> : null}
        {onMinimize ? <Btn variant="outGray" small onClick={() => onMinimize(entry)}>Minimizar</Btn> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <BankSide entry={entry} dateDiffers={dateDiffers} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{right}</div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerButtons entry={entry} isMobile={isMobile} busy={busy} desc={desc} onAnswer={onAnswer} onChange={onChange} onConfirm={onConfirm} />
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
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div data-testid="pair-row" onClick={openOnRowClick(() => onOpen(entry))} style={{ ...ROW_CLICKABLE, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderBottom: `1px solid ${T.border}`, background: entry.answer === "ignore" ? SKIP_BG : "transparent", ...G, fontSize: 12, color: T.inkMid }}>
      <Btn
        ref={alterRef}
        variant="ghost"
        small
        onClick={() => onOpen(entry)}
        aria-label={`Alterar o lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
        style={{ color: T.blue, gap: 2 }}
      >
        <ChevronRight size={13} aria-hidden="true" />Alterar
      </Btn>
      <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, color: entry.amount > 0 ? T.green : T.ink }}>{formatMoney(entry.amount, entry.currency)}</span>
      <StatusBadge entry={entry} />
      <span style={{ flex: 1, minWidth: 160 }}>{rowSummary(entry)}</span>
      {isAnswered(entry) ? <ConferidoBadge /> : null}
      {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} inRow /> : null}
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
          <Btn variant="outGray" small onClick={onUndoConfirmAll} disabled={busy}>Desfazer</Btn>
        </div>
      ) : null}
      {entries.filter(queue.shown).map((entry) => (
        <EntrySlot key={entry.id} entryId={entry.id} open={entry.id === queue.currentId} tone={answerTone(entry.answer)}>
        {entry.id === queue.currentId ? (
        <CurrentEntryFrame queue={queue} entry={entry}>
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
            onConfirm={(e) => queue.advanceFrom(e.id)}
          />
        </CurrentEntryFrame>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <PairRow entry={entry} canUndo={Boolean(history[entry.id]?.length)} focus={queue.rowFocusId === entry.id} onOpen={openRow} onUndoChoice={undoChoice} />
        </div>
        )}
        </EntrySlot>
      ))}
    </div>
  );
}
