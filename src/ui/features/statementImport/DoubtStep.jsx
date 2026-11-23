// Passo "Decidir casos com dúvida" (fincla-api#511).
//
// Lançamentos com VÁRIAS candidatas de mesmo valor, ou com UMA de valor até R$ 1,00 diferente:
// nada vem pré-marcado. Cada cartão mostra o banco à esquerda e as opções do Fincla à direita;
// escolher uma a mostra ligada. Uma transação já escolhida para outro lançamento continua visível,
// desativada, com "Desfazer lá". "Está no Fincla com outros dados…" abre a busca em todas as
// contas da mesma moeda. Responder minimiza o cartão numa linha que continua visível, com
// "Alterar" e "Desfazer escolha": nada some sem um jeito de voltar. Nada muda antes de concluir.
import { memo, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import {
  CONFIRM_BLOCKED_NOTE, ConfirmAnswerButton, SKIP_BG, StatementEntryCard, bankDateLabel, useDescriptionDraft,
} from "./StatementEntryCard.jsx";
import { BankSide, Connector, IgnoredSide, StatusBadge, UndoChoiceButton } from "./SuggestedPairsStep.jsx";
import { FinclaMatchBox, MATCH_BOX, matchTitle, paidWord } from "./FinclaMatchBox.jsx";
import {
  ConferidoBadge, CurrentEntryFrame, EntryQueueHeader, EntrySlot, ROW_CLICKABLE, answerTone, isAnswered, openOnRowClick, useStableCallback,
} from "./entryQueue.jsx";

const QUESTION = "Este lançamento do banco já está no Fincla?";

/** A mesma coisa do Fincla (transação ou transferência)? */
export const sameMatch = (a, b) => Boolean(a && b) && a.kind === b.kind
  && (a.kind === "transfer" ? a.transfer_id === b.transfer_id : a.transaction_id === b.transaction_id);

/** O corpo do PATCH que escolhe esta transação/transferência como o par. */
export const pairBody = (match) => (match.kind === "transfer"
  ? { answer: "pair", paired_transfer_id: match.transfer_id }
  : { answer: "pair", paired_transaction_id: match.transaction_id });

/** O que o lançamento tinha antes de uma resposta, para "Desfazer escolha" devolver exatamente. */
export const answerSnapshot = (entry) => {
  if (entry.answer === null) return { answer: null };
  const snapshot = { answer: entry.answer, confirmed: entry.confirmed };
  if (entry.answer === "pair" && entry.paired_transfer_id) snapshot.paired_transfer_id = entry.paired_transfer_id;
  else if (entry.answer === "pair" && entry.paired_transaction_id) snapshot.paired_transaction_id = entry.paired_transaction_id;
  return snapshot;
};

/** Por que o lançamento está em dúvida, em poucas palavras (linha minimizada e cabeçalho). */
export function doubtHint(entry) {
  const options = entry.candidates ?? [];
  if (options.length > 1) return `${plural(options.length, "opção", "opções")} no Fincla parecidas`;
  if (options.length === 1) {
    const differences = options[0].differences;
    if (differences.includes("amount")) return differences.includes("date") ? "valor quase igual e data diferente" : "valor quase igual";
    return differences.includes("date") ? "data diferente" : "1 opção no Fincla";
  }
  return "sem opção parecida nesta conta";
}

/** O que acontece ao concluir, em uma linha. */
function outcomeText(entry, accountName) {
  const match = entry.fincla_match;
  if (entry.answer === "pair" && match?.kind === "transfer") {
    return <>Ao concluir a conciliação: nada muda em <b>{matchTitle(entry, match)}</b>, que já está no Fincla; nenhuma transação é criada.</>;
  }
  if (entry.answer === "pair" && match) {
    const bits = [<span key="paid"><b>{match.description}</b> {paidWord(entry)} em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco)</span>];
    if (match.differences.includes("amount")) bits.push(<span key="value">o valor passa a <b style={NUM}>{formatMoney(entry.amount, entry.currency)}</b></span>);
    if (match.differences.includes("account")) {
      bits.push(<span key="account">é movida da <b>{match.account_name ?? "outra conta"}</b> para a <b>{accountName || "esta conta"}</b></span>);
    }
    return <>Ao concluir a conciliação: {bits.reduce((acc, bit, i) => (i ? [...acc, "; ", bit] : [bit]), [])}.</>;
  }
  if (entry.answer === "create") return <>Ao concluir a conciliação: será adicionada <b>“{entry.description || "(sem descrição)"}”</b>, paga na data do banco.</>;
  if (entry.answer === "ignore") return <>Este lançamento não entra no Fincla. Ele aparece na conferência de saldo.</>;
  return null;
}

/**
 * As respostas, com o Confirmar ao lado só no formulário do item novo (nada vem pré-marcado numa
 * dúvida, então não há "Confirmar sugestão"). Clicar de novo numa resposta já dada ("Sim, é esta"
 * ou "Não registrar") minimiza o cartão (`onConfirm`), como o atalho.
 */
function Answers({ entry, busy, wantPair, desc, onYes, onAnswer, onChange, onSearch, onConfirm = null }) {
  const buttons = [
    { value: "pair", label: "Sim, é esta", tone: T.blue, pressed: entry.answer === "pair" || (entry.answer === null && wantPair) },
    { value: "create", label: "Não, adicionar agora", tone: T.green, pressed: entry.answer === "create" },
    { value: "ignore", label: "Não registrar", tone: T.inkLight, pressed: entry.answer === "ignore" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{QUESTION}</span>
      <div role="group" aria-label={QUESTION} style={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        {buttons.map((b, index) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={b.pressed}
            disabled={busy}
            onClick={() => {
              if (entry.answer === b.value) {
                if (b.value !== "create" && onConfirm) onConfirm(entry);
                return;
              }
              if (b.value === "pair") onYes();
              else onAnswer(entry, { answer: b.value });
            }}
            style={{
              ...G, minHeight: 32, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
              border: 0, borderRight: index < buttons.length - 1 ? `1px solid ${T.border}` : 0,
              background: b.pressed ? b.tone : "transparent", color: b.pressed ? "#fff" : T.inkLight,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      {entry.answer === "create" && onConfirm ? (
        <ConfirmAnswerButton
          disabled={busy || !desc.value.trim()}
          blockedNote={desc.value.trim() ? "" : CONFIRM_BLOCKED_NOTE}
          onConfirm={() => desc.confirm(onConfirm)}
        />
      ) : null}
      <Btn variant="outGray" small onClick={() => onSearch(entry)} disabled={busy} style={{ alignSelf: "flex-start" }}>
        Está no Fincla com outros dados…
      </Btn>
    </div>
  );
}

/**
 * As opções do Fincla para o lançamento: as candidatas (a escolhida pressionada), as já escolhidas
 * por outro lançamento desativadas com "Desfazer lá", e a escolhida pela busca quando não é candidata.
 */
function Options({ entry, entries, accountName, busy, onPick, onUndoThere, onSearch, onConfirm = null }) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const options = entry.candidates ?? [];
  const chosen = entry.answer === "pair" ? entry.fincla_match : null;
  const chosenOutside = chosen && !options.some((o) => sameMatch(o, chosen));
  if (!options.length && !chosen) {
    return (
      <section style={{ ...MATCH_BOX, background: T.grayLight }}>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "0 0 8px" }}>
          Nada parecido nesta conta. Talvez você tenha lançado em outra conta sua: procure no Fincla.
        </p>
        <Btn variant="outGray" small onClick={() => onSearch(entry)} disabled={busy}>Está no Fincla com outros dados…</Btn>
      </section>
    );
  }
  const free = options.filter((o) => !o.taken_by_entry_id).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
      {entry.answer === null ? (
        <p style={{ ...G, fontSize: 12, fontWeight: 600, color: T.amber, margin: 0 }}>
          {free > 1 ? "Qual destas é o mesmo lançamento do banco? Clique para escolher." : "Confira se é a mesma e clique nela para confirmar."}
        </p>
      ) : null}
      {chosenOutside ? <FinclaMatchBox entry={entry} match={chosen} accountName={accountName} /> : null}
      {options.map((match) => (
        <FinclaMatchBox
          key={`${match.kind}-${match.transaction_id ?? match.transfer_id}`}
          entry={entry}
          match={match}
          accountName={accountName}
          ifChosen={!sameMatch(match, chosen)}
          pressed={sameMatch(match, chosen)}
          takenBy={match.taken_by_entry_id ? byId.get(match.taken_by_entry_id) ?? { id: match.taken_by_entry_id, date: "", bank_description: "outro lançamento" } : null}
          onUndoThere={onUndoThere}
          onPick={busy ? null : (picked) => {
            // Clicar de novo na opção já escolhida só minimiza (a escolha já está gravada).
            if (sameMatch(picked, chosen)) onConfirm?.(entry);
            else onPick(entry, picked);
          }}
        />
      ))}
    </div>
  );
}

/**
 * "Sim, é esta" num lançamento em dúvida (botão ou atalho S): com uma opção livre, escolhe-a; com
 * várias, pede para escolher qual; sem nenhuma, abre a busca no Fincla.
 */
export function doubtYes(entry, { onPick, onWantPair, onSearch }) {
  if (entry.answer === "pair") return;
  const options = (entry.candidates ?? []).filter((o) => !o.taken_by_entry_id);
  if (options.length === 1) onPick(entry, options[0]);
  else if (options.length > 1) onWantPair(entry);
  else onSearch(entry);
}

/** O cartão aberto de um lançamento em dúvida (também usado para um lançamento novo pareado pela busca). */
export function DoubtCard({
  entry, entries, isMobile, busy, canUndo, wantPair = false, categories, details, fallbackLabel, accountName,
  onAnswer, onPick, onWantPair, onChange, onUndoChoice, onUndoThere, onSearch, onMinimize, onConfirm = null,
}) {
  const options = (entry.candidates ?? []).filter((o) => !o.taken_by_entry_id);
  const desc = useDescriptionDraft(entry, onChange);
  const onYes = () => doubtYes(entry, { onPick, onWantPair, onSearch });
  const highlightDate = entry.answer === "pair"
    ? Boolean(entry.fincla_match?.differences.includes("date"))
    : entry.answer === null && options.some((o) => o.differences.includes("date"));
  let right;
  if (entry.answer === "create") {
    right = (
      <StatementEntryCard
        entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange}
        embedded desc={desc}
      />
    );
  } else if (entry.answer === "ignore") {
    // "Não registrar": as opções continuam à vista, listradas e sem clique, com "Fica de fora".
    const shown = entry.fincla_match && !options.some((o) => sameMatch(o, entry.fincla_match)) ? [entry.fincla_match, ...options] : options;
    right = <IgnoredSide entry={entry} matches={shown} accountName={accountName} />;
  } else {
    right = <Options entry={entry} entries={entries} accountName={accountName} busy={busy} onPick={onPick} onUndoThere={onUndoThere} onSearch={onSearch} onConfirm={onConfirm} />;
  }
  const outcome = outcomeText(entry, accountName);
  return (
    <article
      data-testid="doubt-card"
      aria-label={`Lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.answer === null ? T.amber : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        {entry.answer === null ? <Badge color={T.amber} bg={T.amberLight}>Falta responder</Badge> : <StatusBadge entry={entry} />}
        {entry.answer === null ? <span style={{ ...G, fontSize: 12, color: T.inkLight }}>{doubtHint(entry)}</span> : null}
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} /> : null}
        {onMinimize ? <Btn variant="outGray" small onClick={() => onMinimize(entry)}>Minimizar</Btn> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <BankSide entry={entry} dateDiffers={highlightDate} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{right}</div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <Answers
          entry={entry} busy={busy} wantPair={wantPair} desc={desc}
          onYes={onYes} onAnswer={onAnswer} onChange={onChange} onSearch={onSearch} onConfirm={onConfirm}
        />
      </footer>
      {outcome ? (
        <p data-testid="doubt-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>{outcome}
        </p>
      ) : entry.answer === null && wantPair ? (
        <p style={{ ...G, fontSize: 12, color: T.amber, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>Escolha ao lado qual transação é.
        </p>
      ) : null}
    </article>
  );
}

function rowSummary(entry) {
  const match = entry.fincla_match;
  if (entry.answer === "pair" && match) {
    const extras = [];
    if (match.differences.includes("amount")) extras.push("valor do banco");
    if (match.differences.includes("account")) extras.push(`vem da ${match.account_name ?? "outra conta"}`);
    return <>Sim, é <b>{matchTitle(entry, match)}</b>{extras.length ? ` · ${extras.join(" · ")}` : ""}</>;
  }
  if (entry.answer === "create") return <>Adicionar ao Fincla: <b>{entry.description || "(sem descrição)"}</b></>;
  return <span style={{ color: T.inkLight }}>Fica fora do Fincla</span>;
}

/**
 * Um lançamento minimizado numa linha que continua visível; clicar em qualquer ponto dela (ou no
 * "Alterar") a reabre como o cartão atual. Sem resposta, a linha diz "Falta responder" e por quê.
 */
export const DoubtRow = memo(function DoubtRowView({ entry, canUndo, focus = false, onOpen, onUndoChoice }) {
  const alterRef = useRef(null);
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div data-testid="doubt-row" onClick={openOnRowClick(() => onOpen(entry))} style={{ ...ROW_CLICKABLE, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", background: entry.answer === "ignore" ? SKIP_BG : T.surface, border: `1px solid ${T.border}`, borderRadius: 12, ...G, fontSize: 12, color: T.inkMid }}>
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
      {entry.answer === null ? <Badge color={T.amber} bg={T.amberLight}>Falta responder</Badge> : <StatusBadge entry={entry} />}
      <span style={{ flex: 1, minWidth: 160 }}>{entry.answer === null ? <span style={{ color: T.inkLight }}>{doubtHint(entry)}</span> : rowSummary(entry)}</span>
      {isAnswered(entry) ? <ConferidoBadge /> : null}
      {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} inRow /> : null}
    </div>
  );
});

/**
 * O passo inteiro (lista do fincla-api#517): só o lançamento atual (`queue.currentId`) fica aberto;
 * os outros, respondidos ou não, são linhas. `history` guarda as respostas anteriores de cada
 * lançamento ("Desfazer escolha"); `wantPair` = lançamentos em que a pessoa disse "Sim, é esta" sem
 * escolher qual ainda.
 */
export function DoubtStep({
  entries, allEntries, queue, view = "detailed", onViewChange = null, isMobile, busy, categories, details, fallbackLabel, accountName,
  history, wantPair,
  onAnswer, onPick, onWantPair, onChange, onUndoChoice, onUndoThere, onSearch,
}) {
  const pending = entries.filter((e) => e.answer === null).length;
  const openRow = useStableCallback((entry) => queue.open(entry.id));
  const undoChoice = useStableCallback(onUndoChoice);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <EntryQueueHeader queue={queue} view={view} onViewChange={onViewChange} />
      <p role="status" style={{ ...G, ...NUM, fontSize: 13, color: pending ? T.amber : T.green, margin: 0 }}>
        {pending ? `${plural(pending, "lançamento para responder", "lançamentos para responder")} de ${entries.length}` : "Todos respondidos"}
      </p>
      {entries.filter(queue.shown).map((entry) => (
        <EntrySlot key={entry.id} open={entry.id === queue.currentId} tone={answerTone(entry.answer)} queue={queue} entryId={entry.id}>
        {entry.id === queue.currentId ? (
        <CurrentEntryFrame queue={queue} entry={entry}>
          <DoubtCard
            entry={entry}
            entries={allEntries}
            isMobile={isMobile}
            busy={busy}
            canUndo={Boolean(history[entry.id]?.length)}
            wantPair={wantPair.has(entry.id)}
            categories={categories}
            details={details}
            fallbackLabel={fallbackLabel}
            accountName={accountName}
            onAnswer={onAnswer}
            onPick={onPick}
            onWantPair={onWantPair}
            onChange={onChange}
            onUndoChoice={onUndoChoice}
            onUndoThere={onUndoThere}
            onSearch={onSearch}
            onMinimize={(e) => queue.close(e.id)}
            onConfirm={(e) => queue.advanceFrom(e.id)}
          />
        </CurrentEntryFrame>
      ) : (
        <DoubtRow entry={entry} canUndo={Boolean(history[entry.id]?.length)} focus={queue.rowFocusId === entry.id} onOpen={openRow} onUndoChoice={undoChoice} />
        )}
        </EntrySlot>
      ))}
    </div>
  );
}
