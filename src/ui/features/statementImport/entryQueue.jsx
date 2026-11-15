// Volume grande nos passos de lista (fincla-api#517).
//
// Todos os lançamentos do passo aparecem como linhas compactas e só o ATUAL fica aberto como
// cartão. Responder abre o próximo sem resposta (exceto "Não, adicionar agora", que deixa o cartão
// aberto com "Próximo sem resposta →"). O cabeçalho mostra "Lançamento 3 de 30" e quantos faltam;
// o filtro Todos / Falta responder / Respondidos esconde linhas, sempre com o aviso "Mostrar
// todos" (nada some sem aviso). Atalhos: S/A/N respondem, J/K andam; nunca dentro de campos nem
// com um diálogo aberto.
//
// Um passo novo (ex.: "Conferir pagamento de fatura", "Conferir o saldo") adota o mecanismo com:
//   const queue = useEntryQueue(stepKey, entries, { isAnswered });   // na página
//   <EntryQueueHeader queue={queue} view={view} onViewChange={...} />
//   entries.filter(queue.shown).map((e) => e.id === queue.currentId
//     ? <CurrentEntryFrame queue={queue} entry={e}>{cartão}</CurrentEntryFrame>
//     : <linha onClick={openOnRowClick(() => queue.open(e.id))} />)
// e registrando as respostas S/A/N em `useQueueShortcuts`.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { plural } from "../../plural.js";
import { LINK } from "./StatementImportNotes.jsx";

/**
 * Respondido = tem resposta; a sugestão só depois que a pessoa confirma (como no protótipo). Um
 * lançamento a adicionar sem descrição ainda falta (é o que impede concluir).
 */
export function isAnswered(entry) {
  if (entry.answer === null || entry.answer === undefined) return false;
  if (entry.answer === "create" && !String(entry.description ?? "").trim()) return false;
  if (entry.classification === "suggested") return Boolean(entry.confirmed);
  return true;
}

/** O primeiro sem resposta depois de `fromId` (dá a volta na lista), sem contar o próprio. */
export function nextUnanswered(entries, fromId, answered = isAnswered) {
  const start = entries.findIndex((e) => e.id === fromId);
  for (let k = 1; k <= entries.length; k += 1) {
    const candidate = entries[(start + k + entries.length) % entries.length];
    if (candidate && candidate.id !== fromId && !answered(candidate)) return candidate.id;
  }
  return null;
}

export const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Falta responder" },
  { value: "answered", label: "Respondidos" },
];

/**
 * O estado da lista de um passo: qual lançamento está aberto e o filtro, guardados por passo
 * (voltar a um passo devolve onde a pessoa estava). Na primeira visita abre o primeiro sem resposta.
 * `focusTick` muda quando o cartão aberto deve receber o foco (avançar, J/K, reabrir uma linha).
 */
export function useEntryQueue(stepKey, entries, { answered = isAnswered } = {}) {
  const [currentByStep, setCurrentByStep] = useState({});
  const [filterByStep, setFilterByStep] = useState({});
  // Pedido de foco para o cartão aberto: { id, tick }. Atendido uma vez só (`takeFocus`).
  const [focusRequest, setFocusRequest] = useState({ id: null, tick: 0 });
  const servedTick = useRef(0);
  // O lançamento que acabou de minimizar sem outro abrir: o foco vai para o "Alterar" da linha dele.
  const [rowFocusId, setRowFocusId] = useState(null);

  const stored = currentByStep[stepKey];
  const ids = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  let currentId;
  if (stored === undefined) currentId = entries.find((e) => !answered(e))?.id ?? null;
  else currentId = stored !== null && ids.has(stored) ? stored : null;
  const filter = filterByStep[stepKey] ?? "all";
  // A primeira escolha fica guardada: responder o atual não troca o aberto por conta própria.
  const firstPick = stored === undefined && entries.length ? currentId : undefined;
  useEffect(() => {
    if (firstPick !== undefined) setCurrentByStep((prev) => (prev[stepKey] === undefined ? { ...prev, [stepKey]: firstPick } : prev));
  }, [stepKey, firstPick]);

  const pending = entries.filter((e) => !answered(e)).length;
  const shown = useCallback(
    (entry) => filter === "all" || entry.id === currentId || (filter === "pending" ? !answered(entry) : answered(entry)),
    [filter, currentId, answered],
  );
  const visible = entries.filter(shown);

  const setCurrent = useCallback((id, { focus = true, rowFocus = null } = {}) => {
    setCurrentByStep((prev) => ({ ...prev, [stepKey]: id }));
    setRowFocusId(id === null ? rowFocus : null);
    if (focus && id !== null) setFocusRequest((prev) => ({ id, tick: prev.tick + 1 }));
  }, [stepKey]);

  // As ações leem a lista do último render (um callback guardado continua valendo).
  const latest = useRef({ entries, visible, currentId });
  latest.current = { entries, visible, currentId };

  const advanceFrom = useCallback((fromId) => {
    const { entries: list } = latest.current;
    const next = nextUnanswered(list, fromId, answered);
    setCurrent(next, { rowFocus: fromId });
  }, [answered, setCurrent]);

  const move = useCallback((delta) => {
    const { visible: list, currentId: id } = latest.current;
    if (!list.length) return;
    if (id === null) {
      if (delta > 0) setCurrent((list.find((e) => !answered(e)) ?? list[0]).id);
      return;
    }
    const index = list.findIndex((e) => e.id === id);
    const target = list[index + delta];
    if (target) setCurrent(target.id);
  }, [answered, setCurrent]);

  return {
    stepKey,
    entries,
    currentId,
    current: currentId === null ? null : entries.find((e) => e.id === currentId) ?? null,
    position: currentId === null ? 0 : entries.findIndex((e) => e.id === currentId) + 1,
    total: entries.length,
    pending,
    answeredCount: entries.length - pending,
    hidden: entries.length - visible.length,
    filter,
    focusTick: focusRequest.tick,
    /** O cartão `id` deve receber o foco agora? Responde sim uma única vez por pedido. */
    takeFocus: (id) => {
      if (focusRequest.id !== id || focusRequest.tick === servedTick.current) return false;
      servedTick.current = focusRequest.tick;
      return true;
    },
    rowFocusId,
    shown,
    answered,
    hasNextUnanswered: currentId !== null && nextUnanswered(entries, currentId, answered) !== null,
    setFilter: (value) => setFilterByStep((prev) => ({ ...prev, [stepKey]: value })),
    open: (id) => setCurrent(id),
    close: (id) => setCurrent(null, { rowFocus: id }),
    advanceFrom,
    nextUnanswered: () => advanceFrom(latest.current.currentId),
    move,
  };
}

/** Visualização dos cartões: Detalhada (padrão) ou Compacta, lembrada por pessoa no backend. */
export const ViewModeContext = createContext("detailed");
export const useViewMode = () => useContext(ViewModeContext);
export const useCompact = () => useContext(ViewModeContext) === "compact";

/** Os campos de um lado do cartão em uma linha, com o rótulo ao lado de cada valor (Compacta). */
export function InlineFields({ items, testId }) {
  return (
    <div data-testid={testId} style={{ ...G, display: "flex", flexWrap: "wrap", gap: "2px 14px", alignItems: "baseline", fontSize: 13, color: T.ink, minWidth: 0 }}>
      {items.filter(Boolean).map(([label, value]) => (
        <span key={label} style={{ minWidth: 0, wordBreak: "break-word" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.inkLight, marginRight: 5 }}>{label}</span>
          {value}
        </span>
      ))}
    </div>
  );
}

/**
 * Clique em qualquer ponto da linha minimizada a reabre. Um clique num controle de dentro da linha
 * (o "Alterar", "Desfazer", a caixa de marcar) é só dele: a linha não age duas vezes. Teclado e
 * leitor de tela chegam pelo botão "Alterar" (a linha não é um botão com botões dentro).
 */
export function openOnRowClick(onOpen) {
  return (event) => {
    const control = event.target.closest?.("button, a, input, select, textarea, label, [role='button'], [contenteditable='true']");
    if (control && control !== event.currentTarget) return;
    onOpen();
  };
}

/** Estilo de linha clicável (cursor de mão). */
export const ROW_CLICKABLE = { cursor: "pointer" };

function Segmented({ label, options, value, onChange }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 12, color: T.inkLight }}>{label}</span>
      <span role="group" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        {options.map((o, index) => {
          const pressed = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => !pressed && onChange(o.value)}
              style={{
                ...G, ...NUM, minHeight: 28, padding: "0 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: 0,
                borderRight: index < options.length - 1 ? `1px solid ${T.border}` : 0,
                background: pressed ? T.ink : "transparent", color: pressed ? "#fff" : T.inkLight,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </span>
    </span>
  );
}

const KBD = { ...G, fontSize: 11, border: `1px solid ${T.border}`, borderBottomWidth: 2, borderRadius: 4, padding: "0 4px", background: T.surface, color: T.inkMid };

/** "S sim · A adicionar · N não registrar · J/K próximo/anterior", conforme o passo. */
function ShortcutsHint({ keys }) {
  const parts = [];
  if (keys.includes("s")) parts.push(<span key="s"><kbd style={KBD}>S</kbd> sim</span>);
  if (keys.includes("a")) parts.push(<span key="a"><kbd style={KBD}>A</kbd> adicionar</span>);
  if (keys.includes("n")) parts.push(<span key="n"><kbd style={KBD}>N</kbd> não registrar</span>);
  parts.push(<span key="jk"><kbd style={KBD}>J</kbd>/<kbd style={KBD}>K</kbd> próximo/anterior</span>);
  return (
    <p data-testid="queue-shortcuts" style={{ ...G, fontSize: 11, color: T.inkLight, margin: 0 }}>
      Atalhos: {parts.reduce((acc, part, i) => (i ? [...acc, " · ", part] : [part]), [])}
    </p>
  );
}

/**
 * O topo da lista de um passo: posição, quantos faltam, visualização, filtro com contagens, atalhos
 * e o aviso do que o filtro esconde. `children` entra na linha da posição (ex.: "Confirmar todos").
 */
/** As palavras da lista: lançamentos do extrato (padrão) ou transações do Fincla ("Conferir o saldo", #514). */
export const ENTRY_NOUN = {
  title: "Lançamento",
  one: "lançamento",
  many: "lançamentos",
  answeredOne: "lançamento já respondido não aparece",
  answeredMany: "lançamentos já respondidos não aparecem",
  pendingOne: "lançamento sem resposta não aparece",
  pendingMany: "lançamentos sem resposta não aparecem",
};
export const TRANSACTION_NOUN = {
  title: "Transação",
  one: "transação",
  many: "transações",
  answeredOne: "transação já respondida não aparece",
  answeredMany: "transações já respondidas não aparecem",
  pendingOne: "transação sem resposta não aparece",
  pendingMany: "transações sem resposta não aparecem",
};

export function EntryQueueHeader({ queue, view, onViewChange, shortcutKeys = ["s", "a", "n"], noun = ENTRY_NOUN, children = null }) {
  const counts = { all: queue.total, pending: queue.pending, answered: queue.answeredCount };
  let hiddenText = null;
  if (queue.hidden) {
    hiddenText = queue.filter === "pending"
      ? plural(queue.hidden, noun.answeredOne, noun.answeredMany)
      : plural(queue.hidden, noun.pendingOne, noun.pendingMany);
  }
  return (
    <div data-testid="queue-header" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center" }}>
        <span role="status" data-testid="queue-position" style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: T.ink }}>
          {queue.position ? `${noun.title} ${queue.position.toLocaleString("pt-BR")} de ${queue.total.toLocaleString("pt-BR")}` : plural(queue.total, noun.one, noun.many)}
        </span>
        <span data-testid="queue-pending" style={{ ...G, ...NUM, fontSize: 12, fontWeight: 600, color: queue.pending ? T.amber : T.green }}>
          {queue.pending ? plural(queue.pending, "sem resposta", "sem resposta") : "Todos respondidos"}
        </span>
        {children}
        <span style={{ flex: 1 }} />
        {onViewChange ? (
          <Segmented
            label="Visualização:"
            value={view}
            onChange={onViewChange}
            options={[{ value: "detailed", label: "Detalhada" }, { value: "compact", label: "Compacta" }]}
          />
        ) : null}
        <Segmented
          label="Mostrar:"
          value={queue.filter}
          onChange={queue.setFilter}
          options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} (${counts[f.value].toLocaleString("pt-BR")})` }))}
        />
      </div>
      <ShortcutsHint keys={shortcutKeys} />
      {!queue.pending && queue.currentId === null && queue.total ? (
        <p role="note" style={{ ...G, fontSize: 12, color: T.green, margin: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <Check size={13} aria-hidden="true" />Tudo respondido neste passo. Clique em qualquer {noun.one} para rever.
        </p>
      ) : null}
      {hiddenText ? (
        <p data-testid="queue-hidden" style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0, padding: "8px 12px", border: `1px dashed ${T.border}`, borderRadius: 12 }}>
          {hiddenText} com este filtro ·{" "}
          <button type="button" onClick={() => queue.setFilter("all")} style={{ ...LINK, fontSize: 12, color: T.blue }}>Mostrar todos</button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Moldura do cartão aberto: destaque e foco. Quando a pessoa avança (responder, J/K, reabrir uma
 * linha), o foco vem para cá, para teclado e leitor de tela continuarem no lançamento atual.
 * Depois de "Não, adicionar agora" o cartão fica aberto e ganha "Próximo sem resposta →".
 */
export function CurrentEntryFrame({ queue, entry, noun = ENTRY_NOUN, children }) {
  const ref = useRef(null);
  const { takeFocus, focusTick } = queue;
  // biome-ignore lint/correctness/useExhaustiveDependencies: o pedido de foco é o tick; takeFocus muda a cada render.
  useEffect(() => {
    if (takeFocus(entry.id)) ref.current?.focus();
  }, [focusTick, entry.id]);
  const showNext = entry.answer === "create" && queue.hasNextUnanswered;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid="current-entry"
      aria-label={`${noun.title} ${queue.position} de ${queue.total}`}
      style={{ borderRadius: 16, boxShadow: `0 0 0 3px ${T.blueLight}`, outline: "none", display: "flex", flexDirection: "column", gap: 8, scrollMarginTop: 16 }}
    >
      {children}
      {showNext ? (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px 6px" }}>
          <Btn variant="outGray" small onClick={() => queue.nextUnanswered()}>Próximo sem resposta →</Btn>
        </div>
      ) : null}
    </div>
  );
}

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Algum diálogo da página está aberto (busca no Fincla, modais)? Os atalhos ficam desligados. */
const dialogOpen = () => Boolean(document.querySelector("[role='dialog'], [role='alertdialog'], [aria-modal='true'], dialog[open]"));

/**
 * Atalhos de teclado da lista: J/K andam (próximo/anterior entre os que aparecem); S/A/N chamam
 * `answers.s/a/n(entry)` com o lançamento aberto. Ignorados ao digitar num campo, com Ctrl/Cmd/Alt,
 * com a busca aberta (`disabled`) e com qualquer diálogo aberto.
 */
export function useQueueShortcuts(queue, answers, { disabled = false } = {}) {
  const latest = useRef({ queue, answers, disabled });
  latest.current = { queue, answers, disabled };
  const active = Boolean(queue);
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      const { queue: q, answers: a, disabled: off } = latest.current;
      if (!q || off || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && (TYPING.has(target.tagName) || target.isContentEditable)) return;
      if (dialogOpen()) return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        event.preventDefault();
        q.move(key === "j" ? 1 : -1);
        return;
      }
      const answer = a?.[key];
      if (!answer || !q.current) return;
      event.preventDefault();
      answer(q.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);
}

/** Mesma referência entre renders, sempre chamando a versão mais nova (linhas memoizadas não re-renderizam). */
export function useStableCallback(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current?.(...args), []);
}

/**
 * Mantém o mesmo objeto para os lançamentos que não mudaram entre duas leituras do rascunho: com
 * 300 lançamentos, responder um não re-renderiza as outras 299 linhas (que são memoizadas).
 */
export function reuseUnchangedEntries(previous, next) {
  if (!previous || !next) return next;
  const before = new Map(previous.entries.map((e) => [e.id, e]));
  let reused = false;
  const entries = next.entries.map((e) => {
    const old = before.get(e.id);
    if (old && JSON.stringify(old) === JSON.stringify(e)) { reused = true; return old; }
    return e;
  });
  return reused ? { ...next, entries } : next;
}
