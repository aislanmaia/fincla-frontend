/** @vitest-environment jsdom */
// Decisão do Owner (fincla-api#507, 2026-11-24, proposta 3): quando o próximo pendente abre ACIMA
// do item que a pessoa acabou de responder, a linha respondida fica parada e, no lugar do botão
// "↑ Próximo pendente", aparece um RESUMO do pendente: data, descrição e valor do banco, uma linha
// do que o Fincla achou, as mesmas respostas do cartão e "↑ Ver o cartão completo". Responder no
// resumo grava como no cartão (a mesma ação), o pendente recolhe lá em cima sem a tela mexer, uma
// linha verde confirma e o resumo passa para o pendente seguinte. Quando o resumo não basta
// (escolher entre opções, preencher o formulário), ele leva ao cartão.
import React, { useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CurrentEntryFrame, EntrySlot, NextPendingSummaryContext, useEntryQueue, useQueueShortcuts } from "../entryQueue.jsx";

const INITIAL = [
  { id: "a", date: "2026-10-03", bank_description: "PIX ENVIADO MERCADO", amount: -42.5, options: 1, answer: null },
  { id: "b", date: "2026-10-05", bank_description: "TED RECEBIDA", amount: 100, options: 1, answer: "ignore" },
  { id: "c", date: "2026-10-07", bank_description: "PAGTO BOLETO LUZ", amount: -180, options: 2, answer: null },
  { id: "d", date: "2026-10-09", bank_description: "TARIFA PACOTE", amount: -12, options: 0, answer: null },
];

let api;
// Cada resposta que saiu (na página, cada uma é um PATCH), com quem a mandou.
let patches = [];
// Segura a resposta do "servidor" até o teste soltar (null: responde na hora).
let gate = null;
const deferred = () => {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release };
};

const dateLabel = (ymd) => ymd.split("-").reverse().join("/");

function Harness({ initial = INITIAL, withSummary = true }) {
  const [entries, setEntries] = useState(initial);
  const [busy, setBusy] = useState(false);
  const queue = useEntryQueue("doubts", entries);
  // A ação de resposta do passo: a MESMA para o cartão, o resumo e o atalho (como na página).
  const answer = async (entry, value, via) => {
    patches.push({ id: entry.id, body: { answer: value }, via });
    setBusy(true);
    try {
      if (gate) await gate.promise;
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, answer: value } : e)));
      if (value !== "create") queue.advanceFrom(entry.id);
      return true;
    } finally {
      setBusy(false);
    }
  };
  useQueueShortcuts(queue, {
    s: (e) => answer(e, "pair", "atalho"),
    a: (e) => answer(e, "create", "atalho"),
    n: (e) => answer(e, "ignore", "atalho"),
  });
  const stepSummary = useMemo(() => ({
    busy,
    describe: (e) => ({
      dateLabel: dateLabel(e.date),
      title: e.bank_description,
      amountLabel: `R$ ${Math.abs(e.amount).toFixed(2)}`,
      hint: e.options === 1 ? "Sugestão: Mercado" : `${e.options} opções no Fincla`,
      question: "Este lançamento do banco já está no Fincla?",
      answers: [
        e.options === 1
          ? { key: "pair", label: "Sim, é esta", run: () => answer(e, "pair", "resumo"), said: "Sim, é Mercado" }
          : { key: "pair", label: "Sim, é esta", toCard: true, run: null },
        { key: "create", label: "Não, adicionar agora", toCard: true, run: () => answer(e, "create", "resumo") },
        { key: "ignore", label: "Não registrar", run: () => answer(e, "ignore", "resumo"), said: "Fica fora do Fincla" },
      ],
    }),
  }), [busy]);
  api = { queue, setEntries };
  const rows = (
    <div>
      {entries.map((entry) => (
        <EntrySlot key={entry.id} open={entry.id === queue.currentId} queue={queue} entryId={entry.id}>
          {entry.id === queue.currentId ? (
            <CurrentEntryFrame queue={queue} entry={entry}>
              <div data-testid={`card-${entry.id}`}>
                <div role="group" aria-label="Respostas" data-answer-row="">
                  <button type="button" onClick={() => answer(entry, "ignore", "cartão")}>Não registrar {entry.id}</button>
                </div>
              </div>
            </CurrentEntryFrame>
          ) : (
            <div data-testid={`row-${entry.id}`}>
              <button type="button" onClick={() => queue.open(entry.id)}>Alterar {entry.id}</button>
            </div>
          )}
        </EntrySlot>
      ))}
      <button type="button">Concluir passo</button>
    </div>
  );
  return withSummary ? <NextPendingSummaryContext.Provider value={stepSummary}>{rows}</NextPendingSummaryContext.Provider> : rows;
}

/** Abre o último (d), com a e c pendentes acima, e responde ele no cartão: o próximo (a) abre acima. */
async function answerLast(props = {}) {
  const view = render(<Harness {...props} />);
  act(() => api.queue.open("d"));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
  patches = [];
  return view;
}

const summary = () => screen.queryByTestId("next-pending-summary");
const inSummary = (name) => within(summary()).getByRole("button", { name });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  patches = [];
  gate = null;
});

afterEach(() => {
  cleanup();
  delete Element.prototype.scrollIntoView;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resumo do próximo pendente no lugar do botão", () => {
  it("aparece embaixo da linha respondida com data, descrição, valor, o que o Fincla achou e as respostas do cartão", async () => {
    await answerLast();
    expect(api.queue.currentId).toBe("a");
    const s = summary();
    expect(s).toBeInTheDocument();
    // No lugar do botão antigo: nada de "Próximo pendente: 03/10 ..." em botão.
    expect(screen.queryByRole("button", { name: /Próximo pendente:/ })).toBeNull();
    // Dentro do lugar do item respondido, depois da linha dele.
    const slot = screen.getByTestId("row-d").parentElement;
    expect(within(slot).getByTestId("next-pending-summary")).toBe(s);
    expect(within(s).getByTestId("next-pending-entry")).toHaveTextContent("03/10/2026PIX ENVIADO MERCADOR$ 42.50Sugestão: Mercado");
    const group = within(s).getByRole("group", { name: /Este lançamento do banco já está no Fincla\?/ });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sim, é esta", "Não, adicionar agora", "Não registrar"]);
    expect(within(s).getByRole("button", { name: "Ver o cartão completo" })).toBeInTheDocument();
  });

  it("é uma região com nome; o foco que ia para o botão vai para ela, sem rolar", async () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    await answerLast();
    const s = summary();
    expect(s).toHaveAccessibleName("Próximo pendente: 03/10/2026 PIX ENVIADO MERCADO");
    expect(screen.getByRole("region", { name: "Próximo pendente: 03/10/2026 PIX ENVIADO MERCADO" })).toBe(s);
    expect(document.activeElement).toBe(s);
    const call = focus.mock.calls.find((_, i) => focus.mock.contexts[i] === s);
    expect(call).toEqual([{ preventScroll: true }]);
    expect(focus.mock.contexts).not.toContain(screen.getByTestId("current-entry"));
  });

  it("sem o contexto do passo, continua o botão antigo", async () => {
    await answerLast({ withSummary: false });
    expect(summary()).toBeNull();
    expect(screen.getByTestId("next-pending-above")).toHaveTextContent("Próximo pendente: 03/10 PIX ENVIADO MERCADO");
  });
});

describe("responder no resumo", () => {
  it("manda uma resposta só, pela mesma ação do cartão; o pendente recolhe, a linha verde confirma e o resumo passa para o seguinte, sem rolar", async () => {
    await answerLast();
    const s = summary();

    await act(async () => { fireEvent.click(inSummary("Não registrar")); });

    expect(patches).toEqual([{ id: "a", body: { answer: "ignore" }, via: "resumo" }]);
    // O pendente de cima recolheu numa linha; o seguinte (c) é o aberto agora.
    expect(screen.getByTestId("row-a")).toBeInTheDocument();
    expect(screen.queryByTestId("card-a")).toBeNull();
    expect(api.queue.currentId).toBe("c");
    // O mesmo resumo (no mesmo lugar), agora do c, com a confirmação do a no topo.
    expect(summary()).toBe(s);
    expect(within(s).getByTestId("next-pending-entry")).toHaveTextContent("07/10/2026PAGTO BOLETO LUZ");
    const done = within(s).getByRole("status");
    expect(done).toHaveTextContent("03/10/2026 PIX ENVIADO MERCADO·Fica fora do FinclaConferido");
    expect(done).toHaveAttribute("aria-live", "polite");
    expect(s.firstElementChild).toBe(done);
    // Nada rolou e o foco continua no resumo (não foi para o cartão do c, fora da vista).
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(s);
  });

  it("sem pendente seguinte, o resumo sai e o foco volta para a linha respondida (a página segue com 'Tudo respondido')", async () => {
    await answerLast({ initial: INITIAL.map((e) => (e.id === "c" ? { ...e, answer: "ignore" } : e)) });
    await act(async () => { fireEvent.click(inSummary("Sim, é esta")); });
    expect(patches).toEqual([{ id: "a", body: { answer: "pair" }, via: "resumo" }]);
    expect(summary()).toBeNull();
    expect(api.queue.currentId).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("duplo clique manda uma resposta só", async () => {
    await answerLast();
    gate = deferred();
    const button = inSummary("Não registrar");
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => { gate.release(); });
    expect(patches).toEqual([{ id: "a", body: { answer: "ignore" }, via: "resumo" }]);
    expect(api.queue.currentId).toBe("c");
  });

  it("enquanto a resposta não volta, nada muda de lugar, as respostas ficam desligadas e nada é dado como conferido", async () => {
    await answerLast();
    gate = deferred();
    fireEvent.click(inSummary("Não registrar"));
    await act(async () => {});
    expect(api.queue.currentId).toBe("a");
    for (const b of within(summary()).getByRole("group").querySelectorAll("button")) expect(b).toBeDisabled();
    expect(within(summary()).queryByTestId("next-pending-done")).toBeNull();
    await act(async () => { gate.release(); });
    expect(api.queue.currentId).toBe("c");
    expect(within(summary()).getByTestId("next-pending-done")).toHaveTextContent("PIX ENVIADO MERCADO");
  });

  it("responder no cartão (não no resumo) não encadeia: o resumo some, como o botão sumia", async () => {
    await answerLast();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar a" })); });
    expect(patches).toEqual([{ id: "a", body: { answer: "ignore" }, via: "cartão" }]);
    expect(summary()).toBeNull();
  });
});

describe("quando o resumo não basta, leva ao cartão", () => {
  it("'Sim, é esta' com várias opções: nenhuma resposta, rola até o cartão e põe o foco nele", async () => {
    await answerLast();
    await act(async () => { fireEvent.click(inSummary("Não registrar")); });
    patches = [];
    expect(api.queue.currentId).toBe("c");
    const card = screen.getByTestId("current-entry");

    await act(async () => { fireEvent.click(inSummary("Sim, é esta")); });

    expect(patches).toEqual([]);
    expect(Element.prototype.scrollIntoView.mock.contexts).toEqual([card]);
    expect(document.activeElement).toBe(card);
    expect(summary()).toBeNull();
  });

  it("'Não, adicionar agora': grava como o cartão (o formulário fica lá) e leva ao cartão", async () => {
    await answerLast();
    const card = screen.getByTestId("current-entry");
    await act(async () => { fireEvent.click(inSummary("Não, adicionar agora")); });
    expect(patches).toEqual([{ id: "a", body: { answer: "create" }, via: "resumo" }]);
    expect(api.queue.currentId).toBe("a");
    expect(Element.prototype.scrollIntoView.mock.contexts).toEqual([card]);
    expect(document.activeElement).toBe(card);
    expect(summary()).toBeNull();
  });

  it("'Ver o cartão completo' faz o que o botão fazia: rola suave até o pendente, foco nele, o resumo some", async () => {
    await answerLast();
    const card = screen.getByTestId("current-entry");
    fireEvent.click(within(summary()).getByRole("button", { name: "Ver o cartão completo" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(card);
    expect(document.activeElement).toBe(card);
    expect(summary()).toBeNull();
    expect(patches).toEqual([]);
  });
});

describe("atalhos e chegar rolando (OBS-28, BUG-13, OBS-40)", () => {
  /** O cartão aberto com o topo em `geo.top` px da tela; a fileira de respostas `geo.answers` px abaixo. */
  const geo = { top: -500, answers: null };
  const realRect = Element.prototype.getBoundingClientRect;
  beforeEach(() => {
    geo.top = -500;
    geo.answers = null;
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

  async function answerLastInScroller() {
    const { container } = render(<div data-testid="scroller" style={{ overflowY: "auto" }}><Harness /></div>);
    const scroller = container.querySelector("[data-testid='scroller']");
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
    scroller.scrollTop = 1600;
    act(() => api.queue.open("d"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
    patches = [];
    expect(summary()).toBeInTheDocument();
    return scroller;
  }

  const scrollTo = (scroller, top) => {
    geo.top = top;
    fireEvent.scroll(scroller);
  };

  for (const key of ["s", "a", "n"]) {
    it(`com o resumo na tela e o cartão fora da vista, ${key.toUpperCase()} leva ao cartão e não responde`, async () => {
      const user = userEvent.setup();
      await answerLast();
      expect(document.activeElement).toBe(summary());
      await user.keyboard(key);
      expect(patches).toEqual([]);
      expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
      expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
      expect(summary()).toBeNull();
      // Agora à vista: o mesmo atalho responde.
      await act(async () => { await user.keyboard(key); });
      expect(patches).toEqual([{ id: "a", body: { answer: { s: "pair", a: "create", n: "ignore" }[key] }, via: "atalho" }]);
    });
  }

  it("chegar ao pendente rolando tira o resumo, e o 1º N responde o pendente", async () => {
    const user = userEvent.setup();
    const scroller = await answerLastInScroller();
    scrollTo(scroller, 120);
    expect(summary()).toBeNull();
    // O foco estava no resumo: vai para o cartão, que agora está à vista.
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
    await act(async () => { await user.keyboard("n"); });
    expect(patches).toEqual([{ id: "a", body: { answer: "ignore" }, via: "atalho" }]);
  });

  it("rolando sem chegar, o resumo fica", async () => {
    const scroller = await answerLastInScroller();
    scrollTo(scroller, -150);
    expect(summary()).toBeInTheDocument();
  });

  it("OBS-40: com a fileira de respostas do pendente à vista, o 1º S responde o cartão direto e o resumo sai", async () => {
    const user = userEvent.setup();
    await answerLastInScroller();
    geo.answers = 720;
    await act(async () => { await user.keyboard("s"); });
    expect(patches).toEqual([{ id: "a", body: { answer: "pair" }, via: "atalho" }]);
    expect(summary()).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

// A tela não mexe: a resposta do resumo muda o que está ACIMA da linha respondida (o pendente
// recolhe, o seguinte abre), e a rolagem anda exatamente o que o conteúdo de cima andou. jsdom não
// tem layout: a região é simulada (cartão aberto 300 px, linha 100 px, janela de 400 px).
describe("a linha respondida e o resumo ficam parados", () => {
  const OPEN = 300;
  const ROW = 100;
  const VIEW = 400;
  let scroller;
  let scrollTop = 0;
  const slots = () => [...scroller.querySelectorAll("[data-testid='entry-slot']")];
  const heightOf = (el) => (el.dataset.open === "true" ? OPEN : ROW);
  const contentHeight = () => slots().reduce((sum, el) => sum + heightOf(el), 0);
  const spacerHeight = () => Number.parseFloat(scroller.querySelector("[data-testid='entry-anchor-spacer']")?.style.height) || 0;
  const maxScroll = () => Math.max(0, contentHeight() + spacerHeight() - VIEW);
  const realRect = Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    scrollTop = 0;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
      if (this.dataset?.testid !== "entry-slot" || !scroller?.contains(this)) return realRect.call(this);
      let top = 0;
      for (const el of slots()) {
        if (el === this) break;
        top += heightOf(el);
      }
      const st = Math.min(scrollTop, maxScroll());
      return { top: top - st, bottom: top - st + heightOf(this), height: heightOf(this), left: 0, right: 0, width: 0 };
    });
  });

  function renderInScroller(initial) {
    render(
      <div
        data-testid="scroller"
        style={{ overflowY: "auto" }}
        ref={(el) => {
          if (!el || el === scroller) return;
          scroller = el;
          Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW });
          Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => contentHeight() + spacerHeight() });
          Object.defineProperty(el, "scrollTop", { configurable: true, get: () => Math.min(scrollTop, maxScroll()), set: (v) => { scrollTop = Math.max(0, Math.min(v, maxScroll())); } })
        }}
      >
        <Harness initial={initial} />
      </div>,
    );
  }

  const topOf = (id) => screen.getByTestId(`row-${id}`).parentElement.getBoundingClientRect().top;

  for (const [label, initial, next] of [
    ["o seguinte abre acima (a recolhe, c abre)", INITIAL, "c"],
    ["sem seguinte (a recolhe, o resumo sai)", INITIAL.map((e) => (e.id === "c" ? { ...e, answer: "ignore" } : e)), null],
  ]) {
    it(label, async () => {
      renderInScroller(initial);
      act(() => api.queue.open("d"));
      // d aberto no fim, à vista: a (100) b c (100 cada) d (300) = 600; rolagem no fim (200).
      scroller.scrollTop = 1000;
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
      expect(summary()).toBeInTheDocument();
      const before = topOf("d");

      await act(async () => { fireEvent.click(inSummary("Não registrar")); });

      expect(api.queue.currentId).toBe(next);
      expect(topOf("d")).toBe(before);
    });
  }
});

// QA 2026-11-24 (defeito 1): com o resumo na tela, "Alterar" numa linha do meio da lista (entre o
// pendente aberto lá em cima, fora da vista, e a linha com o resumo) fazia a rolagem voltar para
// perto do topo e a linha clicada descia (446 px, depois 157 px). A regra é a de toda troca: a
// linha clicada fica onde está. Layout simulado: um cabeçalho de 500 px acima da lista, cartão
// aberto 300 px, linha 100 px, o resumo 150 px dentro do lugar da linha respondida.
describe("Alterar uma linha com o resumo na tela", () => {
  const HEAD = 500;
  const OPEN = 300;
  const ROW = 100;
  const SUMMARY = 150;
  const VIEW = 400;
  let scroller;
  let scrollTop = 0;
  const slots = () => [...scroller.querySelectorAll("[data-testid='entry-slot']")];
  // A altura animada vale já no primeiro quadro (como no navegador), até a animação acabar.
  const heightOf = (el) => (el.dataset.animHeight ? Number(el.dataset.animHeight) : (el.dataset.open === "true" ? OPEN : ROW) + (el.querySelector("[data-testid='next-pending-summary']") ? SUMMARY : 0));
  const contentHeight = () => HEAD + slots().reduce((sum, el) => sum + heightOf(el), 0);
  const spacerHeight = () => Number.parseFloat(scroller.querySelector("[data-testid='entry-anchor-spacer']")?.style.height) || 0;
  const maxScroll = () => Math.max(0, contentHeight() + spacerHeight() - VIEW);
  const realRect = Element.prototype.getBoundingClientRect;

  let animations = [];
  // Como o navegador: medir força o layout, e a rolagem é cortada se a página encolheu.
  const clamp = () => { scrollTop = Math.min(scrollTop, maxScroll()); return scrollTop; };
  const finishAnimations = () => act(() => { for (const a of animations.splice(0)) a.finish?.(); });

  beforeEach(() => {
    scrollTop = 0;
    animations = [];
    Element.prototype.animate = vi.fn(function animate(keyframes) {
      const a = { onfinish: null, oncancel: null, cancel: vi.fn() };
      if (keyframes[0].height !== undefined) {
        this.dataset.animHeight = Number.parseFloat(keyframes[0].height);
        a.finish = () => { delete this.dataset.animHeight; a.onfinish?.(); };
      }
      animations.push(a);
      return a;
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect() {
      const st = clamp();
      if (this.dataset?.testid === "next-pending-summary" && scroller?.contains(this)) {
        const slot = this.closest("[data-testid='entry-slot']");
        const top = slot.getBoundingClientRect().top + ROW;
        return { top, bottom: top + SUMMARY, height: SUMMARY, left: 0, right: 0, width: 0 };
      }
      if (this.dataset?.testid !== "entry-slot" || !scroller?.contains(this)) return realRect.call(this);
      let top = HEAD;
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
          Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => contentHeight() + spacerHeight() });
          Object.defineProperty(el, "scrollTop", { configurable: true, get: clamp, set: (v) => { scrollTop = Math.max(0, Math.min(v, maxScroll())); } });
        }}
      >
        <Harness initial={initial} />
      </div>,
    );
  }

  const slotOf = (id) => screen.getByTestId(`row-${id}`).parentElement;

  for (const chained of [false, true]) {
    it(chained ? "depois de responder um pendente no resumo, a linha clicada fica parada" : "a linha clicada fica parada", async () => {
      const user = userEvent.setup();
      // a b c pendentes, e pendente, d aberto por último: responder d abre a acima.
      const initial = [
        ...INITIAL.slice(0, 3).map((e) => ({ ...e, answer: null, options: 1 })),
        { id: "e", date: "2026-10-08", bank_description: "PIX ENVIADO PADARIA", amount: -9, options: 1, answer: null },
        INITIAL[3],
      ];
      renderInScroller(initial);
      act(() => api.queue.open("d"));
      scroller.scrollTop = 10_000;
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Não registrar d" })); });
      finishAnimations();
      if (chained) {
        await act(async () => { fireEvent.click(inSummary("Não registrar")); });
        finishAnimations();
        expect(api.queue.currentId).toBe("b");
      }
      expect(summary()).toBeInTheDocument();
      // A pessoa rola até o fim.
      scroller.scrollTop = 10_000;
      // O cartão aberto está acima, fora da vista; a linha e (entre ele e o resumo) está à vista.
      expect(screen.getByTestId("current-entry").closest("[data-testid='entry-slot']").getBoundingClientRect().bottom).toBeLessThanOrEqual(0);
      const before = slotOf("e").getBoundingClientRect().top;
      expect(before).toBeGreaterThanOrEqual(0);
      expect(before).toBeLessThan(VIEW);

      await user.click(screen.getByRole("button", { name: "Alterar e" }));

      expect(api.queue.currentId).toBe("e");
      const clicked = () => screen.getByTestId("current-entry").closest("[data-testid='entry-slot']");
      // No primeiro quadro (o cartão ainda na altura da linha) e no fim da animação.
      expect(clicked().getBoundingClientRect().top).toBe(before);
      finishAnimations();
      expect(clicked().getBoundingClientRect().top).toBe(before);
    });
  }
});
