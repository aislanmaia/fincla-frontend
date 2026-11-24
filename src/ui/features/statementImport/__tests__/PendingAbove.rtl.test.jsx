/** @vitest-environment jsdom */
// Decisão do Owner (fincla-api#507, 2026-11-24, substitui o resumo do próximo pendente): ao
// responder um item, a linha respondida fica parada no lugar e ABAIXO DELA NÃO APARECE NADA (nem
// resumo, nem "↑ Próximo pendente", nem tarja verde). Quando o próximo pendente abre acima, fora
// da vista, o foco fica no "Alterar" da linha respondida. Quem leva ao primeiro pendente é o aviso
// do rodapé do passo ("↑ Falta responder N lançamentos deste passo"), só no clique.
// Os atalhos nunca respondem um cartão fora da vista (OBS-28), mas respondem já no 1º toque com a
// fileira de respostas do cartão inteira à vista (OBS-40).
import React, { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CurrentEntryFrame, EntrySlot, GoToPendingButton, useEntryQueue, useQueueShortcuts } from "../entryQueue.jsx";

const INITIAL = [
  { id: "a", date: "2026-10-03", bank_description: "PIX ENVIADO MERCADO", answer: null },
  { id: "b", date: "2026-10-05", bank_description: "TED RECEBIDA", answer: "ignore" },
  { id: "c", date: "2026-10-07", bank_description: "PAGTO BOLETO LUZ", answer: null },
  { id: "d", date: "2026-10-09", bank_description: "TARIFA PACOTE", answer: null },
];

let api;
// Cada resposta que um atalho mandou (na página, cada uma é um PATCH).
let shortcutAnswers = [];

/** A linha minimizada, com o foco no "Alterar" quando a fila pede (como as linhas dos passos). */
function Row({ entry, focus, onOpen }) {
  const ref = useRef(null);
  useEffect(() => { if (focus) ref.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div data-testid={`row-${entry.id}`}>
      <button ref={ref} type="button" onClick={() => onOpen(entry.id)}>Alterar {entry.id}</button>
      <button type="button" onClick={() => api.setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, answer: null } : e)))}>
        Desfazer {entry.id}
      </button>
      {entry.extra ? <div data-testid={`extra-${entry.id}`}>mais uma linha</div> : null}
    </div>
  );
}

function Harness({ initial = INITIAL }) {
  const [entries, setEntries] = useState(initial);
  const queue = useEntryQueue("doubts", entries);
  const answer = (id, value = "ignore") => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, answer: value } : e)));
    queue.advanceFrom(id);
  };
  const byShortcut = (value) => (e) => {
    shortcutAnswers.push([e.id, value]);
    answer(e.id, value);
  };
  useQueueShortcuts(queue, { s: byShortcut("pair"), a: byShortcut("create"), n: byShortcut("ignore") });
  api = { queue, answer, setEntries };
  return (
    <div>
      {entries.map((entry) => (
        <EntrySlot key={entry.id} open={entry.id === queue.currentId}>
          {entry.id === queue.currentId ? (
            <CurrentEntryFrame queue={queue} entry={entry}>
              <div data-testid={`card-${entry.id}`}>
                <input aria-label={`campo ${entry.id}`} />
                <div role="group" aria-label="Respostas" data-answer-row="">
                  <button type="button" onClick={() => answer(entry.id)}>Não registrar {entry.id}</button>
                </div>
              </div>
            </CurrentEntryFrame>
          ) : (
            <Row entry={entry} focus={queue.rowFocusId === entry.id} onOpen={(id) => queue.open(id)} />
          )}
        </EntrySlot>
      ))}
      <GoToPendingButton queue={queue} />
      <button type="button">Concluir passo</button>
    </div>
  );
}

/** Abre o último (d), com a e c pendentes acima, e responde ele: o próximo (a) abre acima. */
function answerLast() {
  render(<Harness />);
  act(() => api.queue.open("d"));
  fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
}

const slotOfRow = (id) => screen.getByTestId(`row-${id}`).closest("[data-testid='entry-slot']");
const footer = () => screen.queryByTestId("go-to-pending");

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  shortcutAnswers = [];
});

afterEach(() => {
  cleanup();
  delete Element.prototype.scrollIntoView;
  delete globalThis.onscrollend;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("o próximo pendente abre acima do item respondido", () => {
  it("embaixo da linha respondida não aparece nada: o lugar dela tem só a linha", () => {
    answerLast();
    expect(api.queue.currentId).toBe("a");
    expect(slotOfRow("d").children).toHaveLength(1);
    expect(screen.queryByTestId("next-pending-above")).toBeNull();
    expect(screen.queryByTestId("next-pending-summary")).toBeNull();
    expect(screen.queryByTestId("next-pending-done")).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("o foco fica no Alterar da linha respondida (sem rolar), não no cartão fora da tela (OBS-22)", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    answerLast();
    const alterar = screen.getByRole("button", { name: "Alterar d" });
    expect(document.activeElement).toBe(alterar);
    expect(focus.mock.calls.find((_, i) => focus.mock.contexts[i] === alterar)).toEqual([{ preventScroll: true }]);
    expect(focus.mock.contexts).not.toContain(screen.getByTestId("current-entry"));
  });

  it("com o filtro 'Falta responder' (a linha respondida sai da lista), o foco vai para o cartão", () => {
    render(<Harness />);
    act(() => api.queue.setFilter("pending"));
    act(() => api.queue.open("d"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
    expect(api.queue.currentId).toBe("a");
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
  });

  it("com o próximo abrindo abaixo, o foco vai para o cartão aberto, como antes", () => {
    render(<Harness />);
    act(() => api.queue.open("a"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar a" }));
    expect(api.queue.currentId).toBe("c");
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
  });

  it("sem pendente sobrando, o foco fica no Alterar da linha", () => {
    render(<Harness initial={INITIAL.map((e) => (e.id === "d" ? e : { ...e, answer: "ignore" }))} />);
    act(() => api.queue.open("d"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
    expect(api.queue.currentId).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Alterar d" }));
  });

  describe("OBS-28 / OBS-40: atalhos e o cartão fora da vista", () => {
    /** O cartão aberto (moldura) com o topo em `geo.top` px da tela, numa região de 400 px. */
    // `answers`: onde fica a fileira de respostas, em px abaixo do topo do cartão (null: sem medida).
    const geo = { top: -500, answers: null };
    beforeEach(() => {
      geo.top = -500;
      geo.answers = null;
      const realRect = Element.prototype.getBoundingClientRect;
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
        if (this.dataset?.testid === "current-entry") return { top: geo.top, bottom: geo.top + 300, height: 300, left: 0, right: 0, width: 0 };
        if (this.hasAttribute?.("data-answer-row") && geo.answers !== null) {
          const top = geo.top + geo.answers;
          return { top, bottom: top + 32, height: 32, left: 0, right: 0, width: 0 };
        }
        if (this.dataset?.testid === "scroller") return { top: 0, bottom: 400, height: 400, left: 0, right: 0, width: 0 };
        return realRect.call(this);
      });
    });

    /** Uma região de 400 px que rola, com o "d" respondido e o "a" aberto acima, fora da vista. */
    function answerLastInScroller() {
      const { container } = render(
        <div data-testid="scroller" style={{ overflowY: "auto" }}><Harness /></div>,
      );
      const scroller = container.querySelector("[data-testid='scroller']");
      Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
      scroller.scrollTop = 1600;
      act(() => api.queue.open("d"));
      fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
      expect(api.queue.currentId).toBe("a");
      return scroller;
    }

    for (const key of ["n", "s", "a"]) {
      it(`com o pendente fora da vista, ${key.toUpperCase()} traz o cartão e põe o foco nele, sem responder; depois responde`, async () => {
        const user = userEvent.setup();
        answerLastInScroller();

        await user.keyboard(key);

        expect(shortcutAnswers).toEqual([]);
        expect(api.queue.current.answer).toBeNull();
        expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
        expect(document.activeElement).toBe(screen.getByTestId("current-entry"));

        // Agora à vista: o mesmo atalho responde.
        geo.top = 40;
        await user.keyboard(key);
        expect(shortcutAnswers).toHaveLength(1);
        expect(api.queue.entries.find((e) => e.id === "a").answer).not.toBeNull();
      });
    }

    it("com o topo do cartão à vista, o 1º N responde só ele, sem rolar", async () => {
      const user = userEvent.setup();
      answerLastInScroller();
      geo.top = 120;

      await user.keyboard("n");

      expect(shortcutAnswers).toEqual([["a", "ignore"]]);
      expect(api.queue.entries.find((e) => e.id === "c").answer).toBeNull();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it("OBS-40: a fileira de respostas inteira à vista (topo do cartão escondido): o 1º S responde, sem rolar", async () => {
      const user = userEvent.setup();
      answerLastInScroller();
      // O topo do cartão 500 px acima da tela; as respostas em 220–252 px (área de 0 a 400).
      geo.answers = 720;

      await user.keyboard("s");

      expect(shortcutAnswers).toEqual([["a", "pair"]]);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    for (const [label, answersAt] of [["abaixo do fim da área visível", 880], ["cortada pelo fim da área visível", 380], ["sem medida", null]]) {
      it(`OBS-40: com a fileira de respostas ${label}, S traz o cartão (não responde)`, async () => {
        const user = userEvent.setup();
        answerLastInScroller();
        geo.answers = answersAt === null ? null : 500 + answersAt;

        await user.keyboard("s");

        expect(shortcutAnswers).toEqual([]);
        expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
      });
    }

    it("OBS-40: com o topo grudado cobrindo a fileira de respostas, S traz o cartão", async () => {
      const user = userEvent.setup();
      const scroller = answerLastInScroller();
      // O topo grudado cobre até 80 px; as respostas em 60–92 px.
      scroller.dataset.stickyCover = "80";
      geo.answers = 560;

      await user.keyboard("s");

      expect(shortcutAnswers).toEqual([]);
    });

    it("OBS-40: com o aviso grudado no fim cobrindo a fileira de respostas, S traz o cartão", async () => {
      const user = userEvent.setup();
      const scroller = answerLastInScroller();
      // O aviso do rodapé cobre os últimos 60 px (340–400); as respostas em 350–382 px.
      scroller.dataset.stickyBottom = "60";
      geo.answers = 850;

      await user.keyboard("s");

      expect(shortcutAnswers).toEqual([]);
    });
  });
});

describe("o aviso do rodapé: '↑ Falta responder N lançamentos deste passo'", () => {
  it("mostra quantos faltam, com nome acessível de ir ao primeiro, e um alvo de toque de 44 px", () => {
    render(<Harness />);
    const b = footer();
    expect(b).toHaveTextContent("Falta responder 3 lançamentos deste passo");
    expect(b).toHaveAccessibleName("Falta responder 3 lançamentos deste passo. Ir para o primeiro item que falta responder");
    expect(b.tagName).toBe("BUTTON");
    expect(Number.parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(44);
    // Gruda no fim da área que rola, para ficar à vista no meio de uma lista longa.
    expect(screen.getByTestId("go-to-pending-bar").style.position).toBe("sticky");
  });

  it("a contagem acompanha as respostas e o aviso some com 0", () => {
    render(<Harness />);
    act(() => api.answer("a"));
    expect(footer()).toHaveTextContent("Falta responder 2 lançamentos deste passo");
    act(() => api.answer("c"));
    expect(footer()).toHaveTextContent("Falta responder 1 lançamento deste passo");
    act(() => api.answer("d"));
    expect(footer()).toBeNull();
    expect(screen.queryByTestId("go-to-pending-bar")).toBeNull();
    // Desfazer uma resposta traz o aviso de volta.
    fireEvent.click(screen.getByRole("button", { name: "Desfazer b" }));
    expect(footer()).toHaveTextContent("Falta responder 1 lançamento deste passo");
  });

  it("com o primeiro pendente aberto acima (fora da vista), o clique rola suave até ele e põe o foco nele sem rolar de novo", () => {
    answerLast();
    const card = screen.getByTestId("current-entry");
    const focus = vi.spyOn(card, "focus");

    fireEvent.click(footer());

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(card);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(card);
    expect(api.queue.currentId).toBe("a");
  });

  it("com outro cartão aberto, o clique abre o PRIMEIRO pendente da lista e leva até ele", () => {
    render(<Harness />);
    act(() => api.queue.open("c"));
    fireEvent.click(footer());
    expect(api.queue.currentId).toBe("a");
    const card = screen.getByTestId("current-entry");
    expect(card).toHaveAttribute("data-entry-id", "a");
    expect(Element.prototype.scrollIntoView.mock.contexts).toEqual([card]);
    expect(document.activeElement).toBe(card);
  });

  it("com o primeiro pendente abaixo (a pessoa reabriu um respondido), leva para baixo também", () => {
    render(<Harness initial={INITIAL.map((e) => (e.id === "a" ? { ...e, answer: "ignore" } : e))} />);
    act(() => api.queue.open("a"));
    fireEvent.click(footer());
    expect(api.queue.currentId).toBe("c");
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toHaveAttribute("data-entry-id", "c");
  });

  it("com movimento reduzido, a rolagem é na hora", () => {
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    answerLast();
    fireEvent.click(footer());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
  });

  it("com rolagem suave a andar, o foco só vai depois do fim da rolagem (scrollend), sem temporizador", () => {
    globalThis.onscrollend = null;
    const { container } = render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}><Harness /></div>,
    );
    const scroller = container.querySelector("[data-testid='scroller']");
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
    act(() => api.queue.open("d"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
    const card = screen.getByTestId("current-entry");
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 500, bottom: 800, height: 300, left: 0, right: 0, width: 0 });
    const focus = vi.spyOn(card, "focus");

    fireEvent.click(footer());

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).not.toHaveBeenCalled();
    act(() => { scroller.dispatchEvent(new Event("scrollend")); });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("nada rola sem o clique: responder, abrir e desfazer não mexem na tela", () => {
    answerLast();
    fireEvent.click(screen.getByRole("button", { name: "Alterar b" }));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar b" }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer b" }));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("dentro de uma região que rola, publica a altura que cobre no fim (data-sticky-bottom, scroll-padding-bottom) e devolve ao sumir", () => {
    const { container } = render(
      <div data-testid="scroller" style={{ overflowY: "auto" }}><Harness /></div>,
    );
    const scroller = container.querySelector("[data-testid='scroller']");
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
    // A região só passa a rolar depois do primeiro render: a próxima mudança publica.
    act(() => api.answer("a"));
    expect(scroller.dataset.stickyBottom).toBeDefined();
    expect(scroller.style.scrollPaddingBottom).not.toBe("");
    act(() => api.answer("c"));
    act(() => api.answer("d"));
    expect(footer()).toBeNull();
    expect(scroller.dataset.stickyBottom).toBeUndefined();
    expect(scroller.style.scrollPaddingBottom).toBe("");
  });
});

// Layout simulado: a linha respondida (ou a clicada) fica parada (0 px), inclusive no fim da lista
// e com a linha mudando de altura no meio da animação (QA 2026-11-24).
describe("com layout simulado: nada pula", () => {
  const OPEN = 300;
  const ROW = 100;
  const EXTRA = 50;
  const BAR = 60;
  let HEAD_NOW = 500;
  let VIEW = 400;
  let scroller;
  let scrollTop = 0;
  const slots = () => [...scroller.querySelectorAll("[data-testid='entry-slot']")];
  const rowHeight = (el) => ROW + (el.querySelector("[data-testid^='extra-']") ? EXTRA : 0);
  // A altura animada vale já no primeiro quadro (como no navegador), até a animação acabar.
  const heightOf = (el) => (el.dataset.animHeight ? Number(el.dataset.animHeight) : el.dataset.open === "true" ? OPEN : rowHeight(el));
  const contentHeight = () => HEAD_NOW + slots().reduce((sum, el) => sum + heightOf(el), 0) + (scroller.querySelector("[data-testid='go-to-pending-bar']") ? BAR : 0);
  const spacerHeight = () => Number.parseFloat(scroller.querySelector("[data-testid='entry-anchor-spacer']")?.style.height) || 0;
  // Como no navegador, o scrollHeight nunca fica abaixo da janela (clientHeight).
  const scrollHeight = () => Math.max(VIEW, contentHeight() + spacerHeight());
  const maxScroll = () => scrollHeight() - VIEW;

  let animations = [];
  // Como o navegador: medir força o layout, e a rolagem é cortada se a página encolheu.
  const clamp = () => { scrollTop = Math.min(scrollTop, maxScroll()); return scrollTop; };
  const finishAnimations = () => act(() => { for (const a of animations.splice(0)) a.finish?.(); });

  beforeEach(() => {
    scrollTop = 0;
    HEAD_NOW = 500;
    VIEW = 400;
    animations = [];
    Element.prototype.animate = vi.fn(function animate(initialKeyframes) {
      let keyframes = initialKeyframes;
      const a = { onfinish: null, oncancel: null, cancel: vi.fn(), effect: { getKeyframes: () => keyframes, setKeyframes: (k) => { keyframes = k; } } };
      if (keyframes[0].height !== undefined) {
        this.dataset.animHeight = Number.parseFloat(keyframes[0].height);
        a.finish = () => { delete this.dataset.animHeight; a.onfinish?.(); };
        a.cancel = () => { delete this.dataset.animHeight; a.oncancel?.(); };
      }
      animations.push(a);
      return a;
    });
    const realRect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
      const st = clamp();
      if (this.dataset?.testid === "current-entry" && scroller?.contains(this)) return this.closest("[data-testid='entry-slot']").getBoundingClientRect();
      // A linha recolhida ocupa o topo do lugar dela.
      if (/^row-/.test(this.dataset?.testid ?? "") && scroller?.contains(this)) {
        const slot = this.closest("[data-testid='entry-slot']");
        const { top } = slot.getBoundingClientRect();
        return { top, bottom: top + rowHeight(slot), height: rowHeight(slot), left: 0, right: 0, width: 0 };
      }
      if (this.dataset?.testid === "go-to-pending-bar" && scroller?.contains(this)) {
        const top = contentHeight() - BAR - st;
        return { top, bottom: top + BAR, height: BAR, left: 0, right: 0, width: 0 };
      }
      if (this.dataset?.testid !== "entry-slot" || !scroller?.contains(this)) return realRect.call(this);
      let top = HEAD_NOW;
      for (const el of slots()) {
        if (el === this) break;
        top += heightOf(el);
      }
      return { top: top - st, bottom: top - st + heightOf(this), height: heightOf(this), left: 0, right: 0, width: 0 };
    });
  });

  afterEach(() => { delete Element.prototype.animate; });

  function renderInScroller(initial) {
    render(
      <div
        data-testid="scroller"
        style={{ overflowY: "auto" }}
        ref={(el) => {
          if (!el || el === scroller) return;
          scroller = el;
          Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW });
          Object.defineProperty(el, "scrollHeight", { configurable: true, get: scrollHeight });
          Object.defineProperty(el, "scrollTop", { configurable: true, get: clamp, set: (v) => { scrollTop = Math.max(0, Math.min(v, maxScroll())); } });
        }}
      >
        <Harness initial={initial} />
      </div>,
    );
  }

  const slotTop = (id) => slotOfRow(id).getBoundingClientRect().top;
  const openSlot = () => screen.getByTestId("current-entry").closest("[data-testid='entry-slot']");
  // a b c pendentes, e pendente, d aberto por último: responder d abre a, acima.
  const FIVE = [
    ...INITIAL.slice(0, 3).map((e) => ({ ...e, answer: null })),
    { id: "e", date: "2026-10-08", bank_description: "PIX ENVIADO PADARIA", answer: null },
    INITIAL[3],
  ];

  it("responder o último com a rolagem no fim: a linha respondida fica parada, no primeiro quadro e no fim da animação", async () => {
    renderInScroller(FIVE);
    act(() => api.queue.open("d"));
    finishAnimations();
    scroller.scrollTop = 10_000;
    const before = openSlot().getBoundingClientRect().top;

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });

    expect(api.queue.currentId).toBe("a");
    expect(slotTop("d")).toBe(before);
    finishAnimations();
    expect(slotTop("d")).toBe(before);
    // Embaixo da linha, nada (a cópia antiga da animação já saiu).
    expect(slotOfRow("d").children).toHaveLength(1);
  });

  it("'Alterar' numa linha entre o pendente aberto lá em cima e a linha respondida: a linha clicada fica parada", async () => {
    const user = userEvent.setup();
    renderInScroller(FIVE);
    act(() => api.queue.open("d"));
    scroller.scrollTop = 10_000;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
    finishAnimations();
    scroller.scrollTop = 10_000;
    // O cartão aberto está acima, fora da vista; a linha e está à vista.
    expect(openSlot().getBoundingClientRect().bottom).toBeLessThanOrEqual(0);
    const before = slotTop("e");
    expect(before).toBeGreaterThanOrEqual(0);
    expect(before).toBeLessThan(VIEW);

    await user.click(screen.getByRole("button", { name: "Alterar e" }));

    expect(api.queue.currentId).toBe("e");
    expect(openSlot().getBoundingClientRect().top).toBe(before);
    finishAnimations();
    expect(openSlot().getBoundingClientRect().top).toBe(before);
  });

  it("a linha que cresce no commit logo depois da troca (retarget) não faz a linha respondida descer no fim da animação", async () => {
    VIEW = 800;
    // a pendente, b respondido, c aberto (pendente), d respondido: responder c abre a, acima.
    renderInScroller([{ ...INITIAL[0] }, { ...INITIAL[1] }, { ...INITIAL[2] }, { ...INITIAL[3], answer: "ignore" }]);
    act(() => api.queue.open("c"));
    finishAnimations();
    scroller.scrollTop = 200;
    const before = openSlot().getBoundingClientRect().top;

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar c" })); });
    // A releitura do rascunho muda a linha no meio da animação (mais uma linha de texto).
    act(() => api.setEntries((list) => list.map((e) => (e.id === "c" ? { ...e, extra: true } : e))));

    expect(slotTop("c")).toBe(before);
    finishAnimations();
    expect(slotTop("c")).toBe(before);
  });

  it("o aviso do rodapé sumindo (último pendente respondido) com a rolagem no fim não faz a linha descer", async () => {
    renderInScroller([{ ...INITIAL[0], answer: "ignore" }, { ...INITIAL[1] }, { ...INITIAL[2], answer: "ignore" }, INITIAL[3]]);
    act(() => api.queue.open("d"));
    finishAnimations();
    scroller.scrollTop = 10_000;
    const before = openSlot().getBoundingClientRect().top;
    expect(footer()).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });

    expect(footer()).toBeNull();
    expect(slotTop("d")).toBe(before);
    finishAnimations();
    expect(slotTop("d")).toBe(before);
  });

  it("o clique no aviso termina as animações e rola até o primeiro pendente (o único movimento)", async () => {
    renderInScroller(FIVE);
    act(() => api.queue.open("d"));
    scroller.scrollTop = 10_000;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(within(scroller).getByTestId("go-to-pending"));

    expect(Element.prototype.scrollIntoView.mock.contexts).toEqual([screen.getByTestId("current-entry")]);
    expect(scroller.querySelector("[data-anim-height]")).toBeNull();
  });
});
