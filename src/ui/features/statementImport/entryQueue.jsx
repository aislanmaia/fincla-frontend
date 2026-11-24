// Volume grande nos passos de lista (fincla-api#517).
//
// Todos os lançamentos do passo aparecem como linhas compactas e só o ATUAL fica aberto como
// cartão. Responder abre o próximo sem resposta (exceto "Não, adicionar agora", que deixa o cartão
// aberto com o formulário e o "Confirmar" ao lado das respostas). O cabeçalho mostra "Lançamento 3 de 30" e quantos faltam;
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
import { Component, createContext, createRef, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { plural } from "../../plural.js";

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
  // O foco vai para o "Alterar" da linha deste lançamento: o que acabou de minimizar sem outro abrir,
  // ou com o próximo pendente aberto ACIMA dele, fora da vista (fincla-api#507).
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
    setRowFocusId(id === null || !focus ? rowFocus : null);
    if (focus && id !== null) setFocusRequest((prev) => ({ id, tick: prev.tick + 1 }));
  }, [stepKey]);

  // As ações leem a lista do último render (um callback guardado continua valendo).
  const latest = useRef({ entries, visible, currentId, filter });
  latest.current = { entries, visible, currentId, filter };

  const advanceFrom = useCallback((fromId) => {
    const { entries: list, filter: shownNow } = latest.current;
    const next = nextUnanswered(list, fromId, answered);
    const index = (id) => list.findIndex((e) => e.id === id);
    // O próximo pendente abre ACIMA (ex.: respondeu o último da lista): a linha respondida fica
    // parada, nada aparece embaixo dela e o foco fica no "Alterar" dela, à vista. O cartão de cima
    // não recebe o foco: o primeiro Tab não entra num cartão que a pessoa não vê (OBS-22). Quem leva
    // até ele é o aviso do rodapé do passo (`GoToPendingButton`). Com o filtro "Falta responder",
    // a linha respondida some da lista: o foco vai para o cartão, como antes.
    if (next !== null && index(next) < index(fromId) && shownNow !== "pending") setCurrent(next, { focus: false, rowFocus: fromId });
    else setCurrent(next, { rowFocus: fromId });
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
    /** O primeiro sem resposta do passo, na ordem da lista (ou null). */
    firstPendingId: entries.find((e) => !answered(e))?.id ?? null,
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
    open: (id, { focus = true } = {}) => setCurrent(id, { focus }),
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
  // A altura do cabeçalho muda acima da lista (o "Tudo respondido…" ao responder o último pendente,
  // a contagem que quebra a linha): a lista fica parada (BUG-09). Medido depois de toda mudança do
  // commit, antes da pintura.
  const ref = useRef(null);
  const lastHeight = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.getBoundingClientRect().height;
    const previous = lastHeight.current;
    lastHeight.current = height;
    if (previous !== null && Math.abs(height - previous) >= 0.5) keepBelowInPlace(el, height - previous);
  });
  return (
    <div ref={ref} data-testid="queue-header" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          <Btn variant="outGray" small onClick={() => queue.setFilter("all")}>Mostrar todos</Btn>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Moldura do cartão aberto: destaque e foco. Quando a pessoa avança (responder, J/K, reabrir uma
 * linha), o foco vem para cá, para teclado e leitor de tela continuarem no lançamento atual.
 * Depois de "Não, adicionar agora" o cartão fica aberto; o "Confirmar" ao lado das respostas
 * (no próprio cartão) o minimiza.
 */
export function CurrentEntryFrame({ queue, entry, noun = ENTRY_NOUN, children }) {
  const ref = useRef(null);
  const { takeFocus, focusTick } = queue;
  // O pedido de foco é o tick (takeFocus muda a cada render).
  useEffect(() => {
    // preventScroll: a tela não pula para o próximo cartão; quem fica parado é o que minimizou.
    if (takeFocus(entry.id)) ref.current?.focus({ preventScroll: true });
  }, [focusTick, entry.id]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid="current-entry"
      data-entry-id={entry.id}
      aria-label={`${noun.title} ${queue.position} de ${queue.total}`}
      style={{ borderRadius: 16, boxShadow: `0 0 0 3px ${T.blueLight}`, outline: "none", display: "flex", flexDirection: "column", gap: 8, scrollMarginTop: 16 }}
    >
      {children}
    </div>
  );
}

/**
 * Selo "Conferido" da linha minimizada (como no protótipo), ao lado de Alterar/Desfazer escolha.
 * `data-okb` é onde a animação de recolher dá o "pop" do selo.
 */
export function ConferidoBadge() {
  return (
    <span data-okb="" data-testid="conferido-badge" style={{ display: "inline-flex" }}>
      <Badge color={T.green} bg={T.greenLight}>
        <Check size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Conferido
      </Badge>
    </span>
  );
}

/** A cor da resposta no brilho da linha que acabou de minimizar (a do protótipo). */
export function answerTone(answer) {
  if (answer === "create") return T.green;
  if (answer === "ignore") return T.inkLight;
  return T.blue;
}

const prefersReducedMotion = () => Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

/** A região que rola em volta do elemento (cada tela é dona do seu scroll, ver CLAUDE.md). */
function scrollParentOf(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement ?? null;
}

/**
 * Quem fica parado na tela numa troca cartão ↔ linha: o item com o foco (o que a pessoa apertou);
 * sem foco em nenhum, o primeiro que recolheu. Nunca o próximo cartão que abriu sozinho.
 */
export function pickAnchor(changes) {
  return changes.find((c) => c.focusInside) ?? changes.find((c) => c.collapsing) ?? null;
}

/**
 * Quanto espaço a mais precisa ficar embaixo para a rolagem `target` caber: com a página mais
 * curta (o último cartão recolheu), o navegador puxaria a rolagem para trás e o item desceria.
 */
export function spacerNeeded({ target, clientHeight, contentHeight }) {
  if (target <= Math.max(0, contentHeight - clientHeight)) return 0;
  return Math.ceil(target + clientHeight - contentHeight);
}

/** A folga entre o topo da área visível e o item que volta para ela (a mesma do `scrollMarginTop`). */
export const ANCHOR_MARGIN = 16;

/**
 * Para onde rolar para o item que o olho acompanha (`oldTop` antes da troca, `newTop` agora, em
 * px da tela) ficar no lugar certo. Todas as medidas na mesma régua: `coverTop` = onde a área
 * visível começa de fato (a borda de baixo do topo grudado); `viewTop` = onde um item que volta
 * para a vista para (essa borda mais a folga de foco do `scroll-padding-top`). A regra da metade
 * mede contra `coverTop`: a folga de foco não esconde nada (BUG-11, 12 px que viravam um pulo).
 *
 * - No topo antigo, o item na forma nova (`newHeight`, a altura da linha)
 *   ainda aparece pelo menos pela metade na área visível: fica exatamente onde estava (nada pula,
 *   BUG-01), mesmo que para isso a região precise de um espaço provisório embaixo.
 * - No topo antigo ele ficaria inteiro ACIMA da área visível (cartão mais alto que a tela, a
 *   pessoa rolou até os botões): manter esse topo deixaria a linha fora da tela e só espaço vazio
 *   à vista (BUG-08). A linha vem para o topo da área visível, onde estava a parte do cartão que a
 *   pessoa via (também quando só uma fresta dela apareceria atrás do topo grudado, BUG-10); e, se
 *   isso deixaria vazio embaixo (fim da lista), a rolagem para no fim do
 *   conteúdo: a linha fica à vista com a lista acima dela, sem espaço provisório.
 */
export function anchorTarget({ scrollTop, oldTop, newTop, newHeight = 0, viewTop, coverTop = viewTop, clientHeight, contentHeight }) {
  const keep = scrollTop + (newTop - oldTop);
  // "Pelo menos metade": exatamente a metade à vista também fica (meio px de folga para o arredondamento).
  if (oldTop + newHeight / 2 >= coverTop - 0.5) return keep;
  const toTop = scrollTop + (newTop - (viewTop + ANCHOR_MARGIN));
  return Math.max(0, Math.min(toTop, contentHeight - clientHeight));
}

/**
 * O espaço provisório no fim da região que rola. Ele só segura a altura que a rolagem atual
 * precisa; encolhe (e some) assim que a pessoa rola ou navega e ele deixa de evitar um pulo.
 * Nenhum temporizador: quem o solta é a rolagem, o fim de uma animação ou a saída do passo.
 */
const spacer = { el: null, scroller: null };

function spacerHost(scroller) {
  return scroller === document.scrollingElement || scroller === document.documentElement ? document.body : scroller;
}

/** Quanto o espaço provisório soma à altura rolável (a altura dele e o `gap` da região). */
function spacerExtent() {
  const { el } = spacer;
  if (!el?.isConnected) return 0;
  const style = getComputedStyle(el.parentElement);
  const gap = /flex|grid/.test(style.display) ? Number.parseFloat(style.rowGap) || 0 : 0;
  return spacerHeight() + gap;
}

/** A altura posta no espaço provisório (lida do estilo: nada de forçar layout para isso). */
function spacerHeight() {
  return Number.parseFloat(spacer.el?.style.height) || 0;
}

function removeSpacer() {
  spacer.scroller?.removeEventListener("scroll", releaseSpacer);
  spacer.el?.remove();
  spacer.el = null;
  spacer.scroller = null;
  releaseAnchoring();
}

function setSpacer(scroller, height) {
  if (spacer.scroller && spacer.scroller !== scroller) removeSpacer();
  if (height <= 0) {
    removeSpacer();
    return;
  }
  if (!spacer.el) {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.dataset.testid = "entry-anchor-spacer";
    Object.assign(el.style, { flex: "none", margin: "0", padding: "0", overflowAnchor: "none", pointerEvents: "none" });
    spacer.el = el;
    spacer.scroller = scroller;
    scroller.addEventListener("scroll", releaseSpacer, { passive: true });
  }
  if (spacer.el.parentElement !== spacerHost(scroller)) spacerHost(scroller).appendChild(spacer.el);
  spacer.el.style.height = `${height}px`;
}

/**
 * Enquanto a troca anda, quem ancora a rolagem é esta tela: a ancoragem própria do navegador
 * (`overflow-anchor`) devolvia a rolagem alguns px a cada mudança de altura e o item tremia.
 */
const ownAnchoring = { scroller: null, previous: "" };

function takeAnchoring(scroller) {
  if (ownAnchoring.scroller === scroller) return;
  releaseAnchoring();
  ownAnchoring.scroller = scroller;
  ownAnchoring.previous = scroller.style.overflowAnchor;
  scroller.style.overflowAnchor = "none";
}

function releaseAnchoring() {
  if (!ownAnchoring.scroller || animating.size || spacer.el) return;
  ownAnchoring.scroller.style.overflowAnchor = ownAnchoring.previous;
  ownAnchoring.scroller = null;
}

/**
 * A altura do conteúdo da região agora, sem o espaço provisório. O `scrollHeight` nunca fica
 * abaixo do `clientHeight`: com o conteúdo mais curto que a janela (no primeiro quadro, o cartão
 * que abre ainda tem a altura da linha), ele esconde quanto falta, o espaço sairia curto
 * exatamente essa diferença e o navegador cortaria a rolagem (QA: a linha clicada descia 15 px).
 * Nesse caso o espaço passa da janela só para medir; quem chama põe a altura certa antes da pintura.
 */
function rawContentHeight(scroller) {
  if (scroller.scrollHeight <= scroller.clientHeight) setSpacer(scroller, scroller.clientHeight + 1);
  return scroller.scrollHeight - (spacer.scroller === scroller ? spacerExtent() : 0);
}

/**
 * A altura FINAL do conteúdo da região, sem o espaço provisório: um lugar que ainda anima a altura
 * conta com a altura de chegada (senão o espaço seria medido curto no meio da animação e a
 * rolagem seria cortada quando ela terminasse).
 */
function contentHeightOf(scroller) {
  let height = rawContentHeight(scroller);
  for (const slot of animating) {
    const el = slot.ref.current;
    if (el?.isConnected && slot.finalHeight !== null && scroller.contains(el)) height -= el.getBoundingClientRect().height - slot.finalHeight;
  }
  return height;
}

/** O topo da janela da região que rola, em px da tela (a borda de cima dela por dentro). */
function scrollportTopOf(scroller) {
  if (scroller === document.scrollingElement || scroller === document.documentElement) return 0;
  return scroller.getBoundingClientRect().top + (scroller.clientTop || 0);
}

/**
 * O topo da área VISÍVEL da região que rola, em px da tela: a janela dela menos o que fica grudado
 * em cima (o topo fixo da conciliação reserva a altura dele no `scroll-padding-top`).
 */
function viewTopOf(scroller) {
  return scrollportTopOf(scroller) + (Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0);
}

/**
 * Onde a área visível da região que rola começa DE FATO, em px da tela: a borda de baixo do que
 * fica grudado em cima. O topo fixo da conciliação publica a altura dele em `data-sticky-cover`
 * (o `scroll-padding-top` soma a ela uma folga de foco, que não cobre nada). Sem isso, o
 * `scroll-padding-top` é a melhor estimativa.
 */
function coverTopOf(scroller) {
  const cover = Number.parseFloat(scroller.dataset?.stickyCover);
  return Number.isFinite(cover) ? scrollportTopOf(scroller) + cover : viewTopOf(scroller);
}

/** Deixa a rolagem em `target` sem o navegador cortar: segura o espaço que faltar embaixo. */
function holdScroll(scroller, target) {
  takeAnchoring(scroller);
  const contentHeight = contentHeightOf(scroller);
  setSpacer(scroller, spacerNeeded({ target, clientHeight: scroller.clientHeight, contentHeight }));
  scroller.scrollTop = target;
}

/**
 * Algo ACIMA da lista mudou de altura (ex.: "Tudo respondido neste passo" aparece no cabeçalho
 * quando o último pendente é respondido, BUG-09): a rolagem anda o mesmo tanto e a lista, com o
 * item respondido, fica parada. Roda no mesmo commit da mudança (efeito de layout), antes da
 * pintura; a âncora das trocas cartão ↔ linha do mesmo commit mede depois disto e soma certo.
 */
export function keepBelowInPlace(el, delta) {
  // Uma troca cartão ↔ linha no mesmo commit já ancora a rolagem medindo tudo no lugar final
  // (inclusive esta mudança): compensar aqui também contaria duas vezes.
  if (!delta || commit.expected) return;
  // A pessoa mexeu no próprio cabeçalho (filtro, visualização, "Mostrar todos"): é ele que o olho
  // acompanha, e ele fica onde está.
  if (el.contains(document.activeElement)) return;
  const scroller = scrollParentOf(el);
  if (!scroller) return;
  // Com o elemento descendo além do fim da área visível, nada da lista abaixo dele está à vista.
  if (el.getBoundingClientRect().bottom > scrollportTopOf(scroller) + scroller.clientHeight) return;
  holdScroll(scroller, Math.max(0, scroller.scrollTop + delta));
}

// Os lugares com animação andando: enquanto houver um, a altura da página ainda não é a final.
const animating = new Set();

/** Encolhe o espaço provisório até o que a rolagem atual ainda precisa (some quando não precisa). */
function releaseSpacer() {
  const { el, scroller } = spacer;
  if (!el || !scroller || animating.size) return;
  const extent = spacerExtent();
  const needed = spacerNeeded({ target: scroller.scrollTop, clientHeight: scroller.clientHeight, contentHeight: scroller.scrollHeight - extent });
  if (needed <= 0) removeSpacer();
  else if (needed < spacerHeight()) el.style.height = `${needed}px`;
}

// As trocas de um mesmo commit do React: todas as fotos (antes) saem antes de qualquer
// `componentDidUpdate`, então a âncora é escolhida com a lista inteira já no lugar final.
const commit = { expected: 0, changes: [] };
let mountedSlots = 0;

function anchorCommit() {
  const changes = commit.changes.filter((c) => c.el?.isConnected);
  commit.changes = [];
  commit.expected = 0;
  // Uma animação anterior ainda andando: termina já, para medir o lugar final de tudo.
  for (const slot of [...animating]) slot.stopMotion();
  const anchor = pickAnchor(changes);
  let held = null;
  if (anchor) {
    // A região medida ANTES da troca: depois dela a página pode ter ficado curta demais para rolar.
    const scroller = anchor.scroller?.isConnected ? anchor.scroller : scrollParentOf(anchor.el);
    if (scroller) {
      const scrollTop = scroller.scrollTop;
      const now = anchor.el.getBoundingClientRect();
      // A altura do item em si (o primeiro filho).
      // A linha já nasce na forma respondida final (a tela põe o lançamento devolvido pelo PATCH
      // no mesmo commit do recolher), então esta é a altura que ela vai ter: a releitura do
      // rascunho não a faz crescer depois (BUG-12: medir a linha provisória de 44 px em vez da
      // final de 80 px fazia a regra da metade errar entre 22 e 40 px atrás do topo grudado).
      const own = anchor.el.firstElementChild?.getBoundingClientRect().height || now.height;
      const target = anchorTarget({
        scrollTop,
        oldTop: anchor.top,
        newTop: now.top,
        newHeight: own,
        viewTop: anchor.viewTop ?? viewTopOf(scroller),
        coverTop: anchor.coverTop ?? coverTopOf(scroller),
        clientHeight: scroller.clientHeight,
        contentHeight: contentHeightOf(scroller),
      });
      holdScroll(scroller, target);
      held = { scroller, target };
    }
  }
  for (const change of changes) {
    // Acima da âncora, trocar de forma animando empurraria o item que o olho acompanha a cada
    // quadro: ali a troca é na hora, já compensada pela rolagem acima.
    const above = anchor && change !== anchor && Boolean(change.el.compareDocumentPosition(anchor.el) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (change.motion && !above) {
      change.slot.play(change);
      // Enquanto a altura anima, a ancoragem do navegador fica desligada nesta região: sem isso,
      // com algo abaixo da lista (no "Conferir o saldo", as notas e o que fica de fora), o
      // navegador ancorava nesse conteúdo e rolava junto com a altura que anima entre cartão e
      // linha: a linha respondida saía do lugar (BUG-12, subia 45 px depois de recolher).
      const region = change.scroller?.isConnected ? change.scroller : scrollParentOf(change.el);
      if (region) takeAnchoring(region);
    } else change.ghost?.remove();
  }
  // Com a animação começando da altura antiga, a página volta a ser alta: o Chrome devolve a
  // rolagem que só tinha sido cortada na medida (e o item escorregaria junto com a altura). A
  // rolagem é posta de novo no alvo, agora com a altura do primeiro quadro.
  if (held) holdFirstFrame(held);
}

/**
 * A rolagem no alvo também no PRIMEIRO quadro das animações. O espaço provisório foi medido com
 * as alturas finais; um cartão que abre começa da altura da linha, e a página fica mais curta até
 * ele crescer. Sem conteúdo embaixo para cobrir isso (a página mais curta que a janela, o fim da
 * lista), o navegador cortava a rolagem e ela não voltava: a linha clicada descia. O espaço cresce
 * até a página do primeiro quadro
 * caber; quando as animações acabam, o `releaseSpacer` o encolhe ao que a altura final pede.
 */
function holdFirstFrame({ scroller, target }) {
  if (!scroller.isConnected) return;
  growSpacerFor(scroller, target, rawContentHeight);
  if (Math.abs(scroller.scrollTop - target) >= 0.5) scroller.scrollTop = target;
}

/**
 * O espaço provisório cresce (aqui nunca encolhe) até a rolagem `target` caber na altura que
 * `measure` dá. A medida pode esticar o espaço (ver `rawContentHeight`): ele volta ao que estava.
 */
function growSpacerFor(scroller, target, measure) {
  const ownHeight = () => (spacer.scroller === scroller ? spacerHeight() : 0);
  const current = ownHeight();
  const needed = spacerNeeded({ target, clientHeight: scroller.clientHeight, contentHeight: measure(scroller) });
  if (needed > current) takeAnchoring(scroller);
  if (needed > current || ownHeight() !== current) setSpacer(scroller, Math.max(needed, current));
}

/**
 * O lugar de um lançamento na lista (cartão aberto ou linha minimizada). Quando ele troca de forma,
 * a altura anda da antiga para a nova (o cartão recolhe na linha, e vice-versa) com o conteúdo
 * antigo sumindo por cima, e a rolagem fica ancorada no item que o olho acompanha: nada pula.
 *
 * A animação é só visual: o estado já mudou antes dela começar, nada espera por ela e nenhum
 * temporizador entra (fincla-api#507). A limpeza (tirar a cópia antiga, devolver o `overflow`)
 * roda no fim OU no cancelamento da animação, e de novo na próxima troca ou ao desmontar: nunca
 * fica um estado "recolhendo" preso. Sem `Element.animate` (jsdom) ou com movimento reduzido, só a
 * âncora da rolagem vale.
 */
export class EntrySlot extends Component {
  ref = createRef();

  animations = [];

  cleanup = null;

  // A altura de chegada enquanto a altura anima (null parado).
  finalHeight = null;

  // A animação da altura e a altura natural do conteúdo quando ela começou.
  grow = null;

  naturalAtPlay = 0;

  componentDidMount() {
    mountedSlots += 1;
  }

  getSnapshotBeforeUpdate(prevProps) {
    if (prevProps.open === this.props.open) return null;
    const el = this.ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const focusInside = el.contains(document.activeElement) && document.activeElement !== document.body;
    const motion = typeof el.animate === "function" && !prefersReducedMotion();
    let ghost = null;
    if (motion && el.firstElementChild) {
      ghost = el.firstElementChild.cloneNode(true);
      for (const node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.setAttribute("inert", "");
      ghost.removeAttribute("data-testid");
      for (const node of ghost.querySelectorAll("[data-testid]")) node.removeAttribute("data-testid");
    }
    if (!commit.expected) {
      // Rede de segurança: se algum `componentDidUpdate` não vier, a troca não fica pendurada.
      queueMicrotask(() => { if (commit.expected) anchorCommit(); });
    }
    commit.expected += 1;
    const scroller = scrollParentOf(el);
    return {
      height: rect.height,
      top: rect.top,
      focusInside,
      motion,
      ghost,
      scroller,
      viewTop: scroller ? viewTopOf(scroller) : 0,
      coverTop: scroller ? coverTopOf(scroller) : 0,
    };
  }

  componentDidUpdate(_prevProps, _prevState, snap) {
    if (!snap) {
      this.retarget();
      return;
    }
    commit.changes.push({ ...snap, slot: this, el: this.ref.current, collapsing: !this.props.open });
    if (commit.changes.length >= commit.expected) anchorCommit();
  }

  componentWillUnmount() {
    this.stopMotion();
    mountedSlots -= 1;
    if (!mountedSlots) removeSpacer();
  }

  /** Termina a animação na hora (o lugar fica na forma final) e limpa. */
  stopMotion() {
    const running = this.animations;
    this.animations = [];
    for (const a of running) a.cancel?.();
    this.cleanup?.();
  }

  /**
   * O conteúdo do lugar mudou de altura no meio da animação (num commit logo depois da troca, ex.:
   * a releitura do rascunho muda a linha): a altura passa a andar até a nova chegada. Sem isso ela
   * ia até a altura antiga e, no fim, pulava para a certa; o espaço provisório, medido com a
   * chegada antiga, não cobria a diferença e o navegador cortava a rolagem no fim (QA: a linha
   * respondida descia 123 px). O espaço cresce agora para a
   * rolagem atual caber na nova chegada; enquanto a altura anima, nada muda na tela.
   */
  retarget() {
    const { grow, finalHeight } = this;
    const el = this.ref.current;
    if (!grow || finalHeight === null || !el?.isConnected || typeof grow.effect?.setKeyframes !== "function") return;
    const to = finalHeight + naturalHeightOf(el) - this.naturalAtPlay;
    if (Math.abs(to - finalHeight) < 0.5) return;
    const [first] = grow.effect.getKeyframes();
    grow.effect.setKeyframes([{ height: first.height }, { height: `${to}px` }]);
    this.finalHeight = to;
    this.naturalAtPlay += to - finalHeight;
    const scroller = scrollParentOf(el);
    if (scroller) growSpacerFor(scroller, scroller.scrollTop, contentHeightOf);
  }

  play({ el, height: from, ghost, collapsing }) {
    this.stopMotion();
    const content = el.firstElementChild;
    const to = el.getBoundingClientRect().height;
    this.naturalAtPlay = naturalHeightOf(el);
    const ease = "cubic-bezier(.2,.7,.2,1)";
    el.style.overflow = "hidden";
    const started = [];
    if (ghost) {
      Object.assign(ghost.style, { position: "absolute", left: "0", right: "0", top: "0", margin: "0", pointerEvents: "none" });
      el.appendChild(ghost);
      started.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }));
    }
    if (content) started.push(content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 80, fill: "backwards" }));
    const grow = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: Math.min(460, 220 + Math.abs(to - from) * 0.35),
      easing: ease,
    });
    started.push(grow);
    this.grow = grow;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      ghost?.remove();
      el.style.overflow = "";
      if (this.cleanup === cleanup) this.cleanup = null;
      animating.delete(this);
      this.finalHeight = null;
      this.grow = null;
      // A altura da página já é a final: o espaço provisório encolhe se não segura mais nada.
      releaseSpacer();
      releaseAnchoring();
    };
    this.cleanup = cleanup;
    this.finalHeight = to;
    animating.add(this);
    grow.onfinish = cleanup;
    grow.oncancel = cleanup;
    if (collapsing && content) {
      // A linha que acabou de ficar no lugar brilha na cor da resposta e o selo "Conferido" aparece.
      const tone = this.props.tone ?? T.blue;
      const on = `inset 4px 0 0 ${tone}, inset 0 0 0 1.5px ${tone}`;
      const off = "inset 4px 0 0 transparent, inset 0 0 0 1.5px transparent";
      started.push(content.animate([{ boxShadow: on, offset: 0 }, { boxShadow: on, offset: 0.25 }, { boxShadow: off }], { duration: 1600, easing: "ease-out" }));
      const badge = el.querySelector("[data-okb]");
      if (badge) {
        started.push(badge.animate(
          [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }],
          { duration: 420, delay: 180, fill: "backwards", easing: "cubic-bezier(.3,1.5,.5,1)" },
        ));
      }
    }
    this.animations = started;
  }

  render() {
    const { open, children } = this.props;
    return (
      <div ref={this.ref} data-testid="entry-slot" data-open={open ? "true" : "false"} style={{ position: "relative", overflowAnchor: "none", borderRadius: 12, minWidth: 0 }}>
        {children}
      </div>
    );
  }
}

/**
 * A altura do conteúdo de um lugar, mesmo com a altura dele presa pela animação: do topo do lugar
 * ao fim do último filho no fluxo (a cópia antiga, posta por cima durante a animação, não conta).
 */
function naturalHeightOf(el) {
  const top = el.getBoundingClientRect().top;
  let bottom = top;
  for (const child of el.children) {
    const style = getComputedStyle(child);
    if (style.position === "absolute" || style.position === "fixed") continue;
    bottom = Math.max(bottom, child.getBoundingClientRect().bottom + (Number.parseFloat(style.marginBottom) || 0));
  }
  return bottom - top;
}

/** O cartão aberto de um lançamento (a moldura `CurrentEntryFrame`). */
function currentCardOf(id) {
  return document.querySelector(`[data-testid="current-entry"][data-entry-id=${JSON.stringify(String(id))}]`);
}

/** Termina na hora as animações de troca cartão ↔ linha (o layout fica no lugar final). */
function finishMotion() {
  for (const slot of [...animating]) slot.stopMotion();
}

/** As interações da pessoa que tomam a rolagem para ela: o foco não espera mais a rolagem acabar. */
const USER_TAKEOVER = ["wheel", "touchstart", "pointerdown", "keydown"];

// O foco que espera o fim de uma rolagem até um cartão (um só por vez).
let pendingReach = null;

function dropPendingReach() {
  if (!pendingReach) return;
  const { events, reach, drop } = pendingReach;
  events.removeEventListener("scrollend", reach);
  for (const type of USER_TAKEOVER) document.removeEventListener(type, drop, true);
  pendingReach = null;
}

/**
 * O fim da fileira de respostas do cartão, em px abaixo do topo dele (0 sem a fileira ou sem
 * medida: aí o cartão conta como o que precisa caber).
 */
function answersOffsetOf(card, cardRect) {
  const rect = card.querySelector(`[${ANSWER_ROW_ATTR}]`)?.getBoundingClientRect();
  return rect?.height ? rect.bottom - cardRect.top : cardRect.height;
}

/**
 * Rola (suave, ou na hora com movimento reduzido) até a fileira de respostas do cartão ficar
 * inteira entre o topo grudado e o aviso grudado no fim (`visibleBand`), mostrando o máximo do
 * cartão: com o topo alinhado logo abaixo do topo grudado (o `scroll-margin-top` do cartão) a
 * fileira já fica à vista, o topo é alinhado; senão (um cartão alto, como uma dúvida com 2 opções
 * no celular), o fim da fileira fica logo acima do aviso (o `scroll-padding-bottom` dele, com a
 * folga). Devolve se a rolagem vai andar.
 */
function bringAnswersIntoView(card) {
  const behavior = prefersReducedMotion() ? "instant" : "smooth";
  const scroller = scrollParentOf(card);
  const cardRect = card.getBoundingClientRect();
  const row = card.querySelector(`[${ANSWER_ROW_ATTR}]`);
  const startTop = scroller ? viewTopOf(scroller) + ANCHOR_MARGIN : ANCHOR_MARGIN;
  const limit = (scroller ? visibleBand(card).bottom : (globalThis.innerHeight ?? Number.POSITIVE_INFINITY)) - ANCHOR_MARGIN;
  const fits = startTop + answersOffsetOf(card, cardRect) <= limit + 0.5;
  const target = fits || !row ? card : row;
  let delta = 0;
  if (fits || !row) delta = cardRect.top - startTop;
  else {
    const paddingBottom = scroller ? Number.parseFloat(getComputedStyle(scroller).scrollPaddingBottom) || 0 : 0;
    const bottom = scroller ? scrollportTopOf(scroller) + scroller.clientHeight - paddingBottom : limit + ANCHOR_MARGIN;
    delta = row.getBoundingClientRect().bottom - bottom;
  }
  let moves = false;
  if (scroller) {
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    moves = Math.abs(Math.max(0, Math.min(scroller.scrollTop + delta, max)) - scroller.scrollTop) >= 1;
  }
  target.scrollIntoView?.({ behavior, block: fits || !row ? "start" : "end" });
  return { scroller, moves };
}

/**
 * Leva até o cartão aberto (`bringAnswersIntoView`) e só depois da rolagem põe o foco nele, sem
 * rolar de novo. Sem distância a andar não vem `scrollend`: o foco vai na hora. Um só ouvinte
 * por vez (dois cliques seguidos não somam), e ele sai se a pessoa mexer antes do fim da rolagem:
 * a rolagem dela não rouba o foco depois. Nenhum temporizador.
 */
function scrollToCard(card) {
  dropPendingReach();
  const { scroller, moves } = bringAnswersIntoView(card);
  const focus = () => card.focus({ preventScroll: true });
  if (prefersReducedMotion() || !moves || !("onscrollend" in globalThis)) {
    focus();
    return;
  }
  const root = !scroller || scroller === document.scrollingElement || scroller === document.documentElement;
  const events = root ? document : scroller;
  const reach = () => {
    dropPendingReach();
    focus();
  };
  const drop = () => dropPendingReach();
  pendingReach = { events, reach, drop };
  events.addEventListener("scrollend", reach);
  for (const type of USER_TAKEOVER) document.addEventListener(type, drop, true);
}

/** A altura mínima de um alvo de toque (WCAG 2.5.5 / diretrizes do iOS e do Android). */
const TOUCH_TARGET = 44;

/**
 * O aviso do rodapé do passo, "↑ Falta responder N lançamentos deste passo" (decisão do Owner,
 * fincla-api#507): um botão que leva ao PRIMEIRO pendente do passo, acima ou abaixo, e põe o foco
 * nele. É o único movimento da tela, e só no clique. Gruda no fim da área que rola enquanto falta
 * responder, para ficar à vista no meio de uma lista longa (celular e computador); some com 0.
 *
 * Classe por causa da foto antes da troca: ao sumir (o último pendente respondido) a página fica
 * mais curta embaixo; com a rolagem no fim, o navegador a puxaria para trás e a lista desceria. A
 * rolagem de antes fica segura pelo espaço provisório, como nas trocas cartão ↔ linha.
 */
export class GoToPendingButton extends Component {
  ref = createRef();

  // O pendente que o clique abriu e para onde a rolagem vai depois do commit.
  goTo = null;

  scroller = null;

  previousPaddingBottom = "";

  componentDidMount() {
    this.reserve();
    // A altura do aviso muda com a largura (a quebra de linha do texto, girar o celular): a reserva
    // acompanha, como a do topo fixo.
    window.addEventListener("resize", this.onResize);
  }

  onResize = () => this.reserve();

  getSnapshotBeforeUpdate() {
    const el = this.ref.current;
    // Uma troca cartão ↔ linha no mesmo commit já ancora a rolagem medindo o layout final (com o
    // aviso já fora): segurar aqui também desfaria o alvo dela.
    if (!el?.isConnected || commit.expected) return null;
    const scroller = scrollParentOf(el);
    return scroller ? { scroller, top: scroller.scrollTop, height: el.getBoundingClientRect().height } : null;
  }

  componentDidUpdate(_prevProps, _prevState, snap) {
    this.reserve();
    const el = this.ref.current;
    if (snap?.scroller.isConnected) {
      const height = el?.isConnected ? el.getBoundingClientRect().height : 0;
      if (height < snap.height - 0.5 && Math.abs(snap.scroller.scrollTop - snap.top) >= 0.5) holdScroll(snap.scroller, snap.top);
    }
    const id = this.goTo;
    const card = id === null ? null : currentCardOf(id);
    if (card) {
      this.goTo = null;
      finishMotion();
      scrollToCard(card);
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.onResize);
    this.release();
  }

  /**
   * Enquanto o aviso existe, a altura dele é o que cobre o fim da área que rola: `data-sticky-bottom`
   * (a faixa visível dos atalhos para antes dele) e o `scroll-padding-bottom` (o foco que a página
   * move não fica atrás dele).
   */
  reserve() {
    const el = this.ref.current;
    if (!el) {
      this.release();
      return;
    }
    const scroller = scrollParentOf(el);
    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement) return;
    if (this.scroller !== scroller) {
      this.release();
      this.scroller = scroller;
      this.previousPaddingBottom = scroller.style.scrollPaddingBottom;
      // Encosta no fim da área que rola: `bottom: 0` grudaria ACIMA do padding de baixo dela e
      // deixaria ali uma faixa onde o conteúdo aparece cortado (como no topo fixo).
      const paddingBottom = Number.parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
      el.style.bottom = `${-paddingBottom}px`;
    }
    const height = el.offsetHeight;
    scroller.dataset.stickyBottom = String(height);
    scroller.style.scrollPaddingBottom = `${height + ANCHOR_MARGIN}px`;
  }

  release() {
    const { scroller } = this;
    if (!scroller) return;
    delete scroller.dataset.stickyBottom;
    scroller.style.scrollPaddingBottom = this.previousPaddingBottom;
    this.scroller = null;
  }

  go = () => {
    const { queue } = this.props;
    const id = queue.firstPendingId;
    if (id === null) return;
    const card = queue.currentId === id ? currentCardOf(id) : null;
    if (card) {
      finishMotion();
      scrollToCard(card);
      return;
    }
    // Abre o pendente (sem o foco do avanço: ele vem depois da rolagem) e rola depois do commit.
    this.goTo = id;
    queue.open(id, { focus: false });
  };

  render() {
    const { queue, noun = ENTRY_NOUN, isMobile = false, indent = 0 } = this.props;
    if (!queue?.pending) return null;
    const what = plural(queue.pending, noun.one, noun.many);
    const label = `Falta responder ${what} deste passo`;
    return (
      <div
        ref={this.ref}
        data-testid="go-to-pending-bar"
        // Uma faixa opaca, como uma barra de ferramentas: o que passa por baixo some de vez (nada
        // fica meio à vista e clicável atrás do botão, como o "Confirmar" de um cartão).
        style={{ position: "sticky", bottom: 0, zIndex: 4, background: T.bg, borderTop: `1px solid ${T.border}`, padding: `8px 0 8px ${indent}px`, margin: "-8px 0", display: "flex" }}
      >
        <Btn
          variant="outAmber"
          full={isMobile}
          data-testid="go-to-pending"
          aria-label={`${label}. Ir para o primeiro item que falta responder`}
          onClick={this.go}
          style={{ minHeight: TOUCH_TARGET, padding: "0 16px", fontSize: 13, color: T.ink, background: T.amberLight, boxShadow: T.sm, whiteSpace: "normal", textAlign: "left" }}
        >
          <ArrowUp size={16} aria-hidden="true" style={{ flexShrink: 0, color: T.amber }} />
          <span>{label}</span>
        </Btn>
      </div>
    );
  }
}

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * A faixa visível (em px da tela) da região que rola em volta de `el`: abaixo do topo grudado e
 * acima do aviso grudado no fim (`data-sticky-bottom`, o "Falta responder" do rodapé do passo).
 */
function visibleBand(el) {
  const scroller = scrollParentOf(el);
  if (!scroller) return { top: 0, bottom: globalThis.innerHeight ?? Number.POSITIVE_INFINITY };
  const coverBottom = Number.parseFloat(scroller.dataset?.stickyBottom) || 0;
  return { top: coverTopOf(scroller), bottom: scrollportTopOf(scroller) + scroller.clientHeight - coverBottom };
}

/**
 * O grupo de botões de resposta de um cartão publica `data-answer-row` (as respostas S/A/N do
 * passo). OBS-40: com ele inteiro na área visível (abaixo do topo grudado e acima do fim da
 * região), a pessoa está vendo o que vai responder, mesmo com o topo de um cartão alto escondido.
 * Sem medida (jsdom, altura zero), não conta.
 */
const ANSWER_ROW_ATTR = "data-answer-row";

function answersInView(card) {
  const row = card.querySelector(`[${ANSWER_ROW_ATTR}]`);
  const rect = row?.getBoundingClientRect();
  if (!rect?.height) return false;
  const { top, bottom } = visibleBand(card);
  return rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
}

/**
 * A pessoa chegou ao pendente: a fileira de respostas dele inteira na faixa visível. Sem a fileira
 * medida (jsdom, um cartão sem ela), vale algum pedaço do cartão à vista.
 */
function answersReached(card) {
  const row = card.querySelector(`[${ANSWER_ROW_ATTR}]`);
  if (row?.getBoundingClientRect().height) return answersInView(card);
  return onScreen(card);
}

/**
 * Algum pedaço do elemento aparece na área visível da região que rola (abaixo do topo grudado)?
 * Sem medida (altura zero, como no jsdom), conta como à vista.
 */
function onScreen(el) {
  const rect = el.getBoundingClientRect();
  if (!rect.height) return true;
  if (!scrollParentOf(el)) return true;
  const { top, bottom } = visibleBand(el);
  return rect.bottom > top + 0.5 && rect.top < bottom - 0.5;
}

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
      // Um atalho nunca responde um cartão cujas respostas a pessoa não está vendo (OBS-28,
      // OBS-40): sem a fileira de respostas inteira entre o topo grudado e o aviso do rodapé (o
      // cartão fora da vista, ou à vista com a fileira atrás do aviso), S/A/N trazem a fileira à
      // vista, como o clique no aviso, e põem o foco no cartão, sem responder. Com ela à vista
      // (mesmo com o topo de um cartão alto escondido), o 1º atalho já responde.
      const card = currentCardOf(q.current.id);
      if (card && !answersReached(card)) {
        dropPendingReach();
        bringAnswersIntoView(card);
        card.focus({ preventScroll: true });
        return;
      }
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
