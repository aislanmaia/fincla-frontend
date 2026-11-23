/** @vitest-environment jsdom */
// Decisão do Owner (fincla-api#507, 2026-11-23): quando o próximo pendente abre ACIMA do item que a
// pessoa acabou de responder (ex.: respondeu o último da lista), a linha recolhida fica parada e
// logo abaixo dela aparece "↑ Próximo pendente: <data> <descrição>". O clique rola suave até o
// pendente (na hora com movimento reduzido) e põe o foco nele sem rolar de novo. Some ao chegar
// nele, ao responder ele ou qualquer outro, ao abrir outro. Sem temporizador. Fecha o BUG-10.
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CurrentEntryFrame, EntrySlot, useEntryQueue, useQueueShortcuts } from "../entryQueue.jsx";

const INITIAL = [
  { id: "a", date: "2026-10-03", bank_description: "PIX ENVIADO MERCADO", answer: null },
  { id: "b", date: "2026-10-05", bank_description: "TED RECEBIDA", answer: "ignore" },
  { id: "c", date: "2026-10-07", bank_description: "PAGTO BOLETO LUZ", answer: null },
  { id: "d", date: "2026-10-09", bank_description: "TARIFA PACOTE", answer: null },
];

let api;
// Cada resposta que um atalho mandou (na página, cada uma é um PATCH).
let shortcutAnswers = [];

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
        <EntrySlot key={entry.id} open={entry.id === queue.currentId} queue={queue} entryId={entry.id}>
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
            <div data-testid={`row-${entry.id}`}>
              <button type="button" onClick={() => queue.open(entry.id)}>Alterar {entry.id}</button>
              <button type="button" onClick={() => api.setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, answer: null } : e)))}>
                Desfazer {entry.id}
              </button>
            </div>
          )}
        </EntrySlot>
      ))}
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

const button = () => screen.queryByTestId("next-pending-above");

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  shortcutAnswers = [];
});

afterEach(() => {
  cleanup();
  delete Element.prototype.scrollIntoView;
  delete globalThis.onscrollend;
  vi.unstubAllGlobals();
});

describe("Próximo pendente acima do item respondido", () => {
  it("aparece logo abaixo da linha recolhida, com data curta e descrição do banco do pendente", () => {
    answerLast();
    expect(api.queue.currentId).toBe("a");
    const b = button();
    expect(b).toBeInTheDocument();
    expect(b).toHaveTextContent("Próximo pendente: 03/10 PIX ENVIADO MERCADO");
    // Dentro do lugar do item respondido, depois da linha dele.
    const slot = screen.getByTestId("row-d").parentElement;
    expect(within(slot).getByTestId("next-pending-above")).toBe(b);
    expect(screen.getByTestId("row-d").compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId("next-pending-above")).toHaveLength(1);
  });

  it("não aparece quando o próximo pendente abre abaixo", () => {
    render(<Harness />);
    act(() => api.queue.open("a"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar a" }));
    expect(api.queue.currentId).toBe("c");
    expect(button()).toBeNull();
  });

  it("não aparece quando não sobra pendente", () => {
    render(<Harness initial={INITIAL.map((e) => (e.id === "d" ? e : { ...e, answer: "ignore" }))} />);
    act(() => api.queue.open("d"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar d" }));
    expect(api.queue.currentId).toBeNull();
    expect(button()).toBeNull();
  });

  it("OBS-22: ao aparecer, o botão recebe o foco (sem rolar), não o cartão fora da tela", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    answerLast();
    expect(document.activeElement).toBe(button());
    const call = focus.mock.calls.find((_, i) => focus.mock.contexts[i] === button());
    expect(call).toEqual([{ preventScroll: true }]);
    // O cartão do pendente não recebeu o foco.
    expect(focus.mock.contexts).not.toContain(screen.getByTestId("current-entry"));
    focus.mockRestore();
  });

  it("OBS-22: sem o botão (o próximo abre abaixo), o foco vai para o cartão aberto, como antes", () => {
    render(<Harness />);
    act(() => api.queue.open("a"));
    fireEvent.click(screen.getByRole("button", { name: "Não registrar a" }));
    expect(button()).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
  });

  it("OBS-22: com o foco no botão, Enter leva ao pendente e põe o foco nele; o botão some", async () => {
    const user = userEvent.setup();
    answerLast();
    expect(document.activeElement).toBe(button());
    await user.keyboard("{Enter}");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
    expect(button()).toBeNull();
  });

  it("OBS-22: Tab a partir do botão segue para o próximo controle depois dele, e o botão continua", async () => {
    const user = userEvent.setup();
    answerLast();
    expect(document.activeElement).toBe(button());
    await user.tab();
    // O próximo controle na ordem da página (abaixo), não o cartão de cima.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Concluir passo" }));
    expect(button()).toBeInTheDocument();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(button());
  });

  it("o clique rola suave até o pendente e põe o foco nele sem rolar de novo; depois some", () => {
    answerLast();
    const card = screen.getByTestId("current-entry");
    const focus = vi.spyOn(card, "focus");
    card.blur();
    fireEvent.click(button());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(card);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(card);
    expect(button()).toBeNull();
  });

  it("com movimento reduzido a rolagem é na hora", () => {
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    answerLast();
    fireEvent.click(button());
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
    // O pendente longe do topo da área visível: a rolagem tem distância a andar.
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 500, bottom: 800, height: 300, left: 0, right: 0, width: 0 });
    const focus = vi.spyOn(card, "focus");
    fireEvent.click(button());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).not.toHaveBeenCalled();
    expect(button()).toBeInTheDocument();
    act(() => { scroller.dispatchEvent(new Event("scrollend")); });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(button()).toBeNull();
  });

  it("some ao responder o pendente apontado", () => {
    answerLast();
    expect(button()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Não registrar a" }));
    expect(button()).toBeNull();
  });

  it("some ao responder outro item (desfazer a escolha de uma linha)", () => {
    answerLast();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer b" }));
    expect(api.queue.currentId).toBe("a");
    expect(button()).toBeNull();
  });

  it("some ao abrir outro item", () => {
    answerLast();
    fireEvent.click(screen.getByRole("button", { name: "Alterar b" }));
    expect(button()).toBeNull();
  });

  it("some quando a pessoa chega no pendente por conta própria (foco num controle dele)", () => {
    answerLast();
    // O foco que o avanço põe na moldura não conta como chegar.
    act(() => screen.getByTestId("current-entry").focus());
    expect(button()).toBeInTheDocument();
    act(() => screen.getByLabelText("campo a").focus());
    expect(button()).toBeNull();
  });

  it("a resposta do próprio item recolhido chegando depois não esconde o botão", () => {
    render(<Harness />);
    act(() => api.queue.open("d"));
    // Avança antes do rascunho trazer a resposta de d (como depois de um PATCH).
    act(() => api.queue.advanceFrom("d"));
    expect(button()).toBeInTheDocument();
    act(() => api.setEntries((list) => list.map((e) => (e.id === "d" ? { ...e, answer: "ignore" } : e))));
    expect(button()).toBeInTheDocument();
  });

  describe("OBS-28: atalhos nunca respondem um cartão fora da vista", () => {
    for (const key of ["n", "s", "a"]) {
      it(`com o foco no "Próximo pendente", ${key.toUpperCase()} faz o que o botão faz: leva ao pendente, sem responder`, async () => {
        const user = userEvent.setup();
        answerLast();
        expect(document.activeElement).toBe(button());

        await user.keyboard(key);

        // O pendente de cima continua sem resposta e aberto; a tela foi até ele, com o foco nele.
        expect(api.queue.current.answer).toBeNull();
        expect(api.queue.currentId).toBe("a");
        expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
        expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
        expect(button()).toBeNull();

        // Agora à vista: o mesmo atalho responde.
        await user.keyboard(key);
        expect(api.queue.entries.find((e) => e.id === "a").answer).not.toBeNull();
      });
    }

    it("o botão à vista vale mesmo com o foco fora dele (clique na página): o atalho leva, não responde", async () => {
      const user = userEvent.setup();
      answerLast();
      act(() => document.activeElement.blur());
      await user.keyboard("n");
      expect(api.queue.entries.find((e) => e.id === "a").answer).toBeNull();
      expect(document.activeElement).toBe(screen.getByTestId("current-entry"));
    });

    it("sem o botão, com o cartão aberto todo fora da área visível: o atalho traz o cartão, não responde", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div data-testid="scroller" style={{ overflowY: "auto" }}><Harness /></div>,
      );
      const scroller = container.querySelector("[data-testid='scroller']");
      Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
      Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
      act(() => api.queue.open("c"));
      const card = screen.getByTestId("current-entry");
      // A região começa no topo da tela; o cartão está 300 px abaixo do fim dela.
      vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 400, height: 400, left: 0, right: 0, width: 0 });
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({ top: 700, bottom: 900, height: 200, left: 0, right: 0, width: 0 });

      await user.keyboard("n");

      expect(api.queue.entries.find((e) => e.id === "c").answer).toBeNull();
      expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(card);
      expect(document.activeElement).toBe(card);

      // Uma parte dele à vista: responde.
      card.getBoundingClientRect.mockReturnValue({ top: 350, bottom: 550, height: 200, left: 0, right: 0, width: 0 });
      await user.keyboard("n");
      expect(api.queue.entries.find((e) => e.id === "c").answer).toBe("ignore");
    });
  });

  describe("BUG-13: a pessoa chega ao pendente rolando por conta própria", () => {
    /** O cartão aberto (moldura) com o topo em `geo.top` px da tela; o resto sem medida. */
    // `answers`: onde fica a fileira de respostas, em px abaixo do topo do cartão (null: sem medida).
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
      expect(button()).toBeInTheDocument();
      return scroller;
    }

    const scrollTo = (scroller, cardTop) => {
      scroller.scrollTop -= cardTop - geo.top;
      geo.top = cardTop;
      fireEvent.scroll(scroller);
    };

    it("com o topo do cartão pendente à vista, o botão some sem mexer na rolagem e o 1º N responde esse cartão", async () => {
      const user = userEvent.setup();
      const scroller = answerLastInScroller();
      expect(document.activeElement).toBe(button());

      scrollTo(scroller, 120);
      const top = scroller.scrollTop;

      expect(button()).toBeNull();
      expect(scroller.scrollTop).toBe(top);
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      // O foco estava no botão que saiu: vai para o cartão à vista, sem rolar.
      expect(document.activeElement).toBe(screen.getByTestId("current-entry"));

      await user.keyboard("n");
      expect(api.queue.entries.find((e) => e.id === "a").answer).toBe("ignore");
      // Só ele: o outro pendente continua sem resposta (uma resposta, um PATCH na página).
      expect(api.queue.entries.find((e) => e.id === "c").answer).toBeNull();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it("rolando sem chegar (o topo do cartão ainda fora da vista), o botão fica e N age como ele, sem responder", async () => {
      const user = userEvent.setup();
      const scroller = answerLastInScroller();

      scrollTo(scroller, -150);
      expect(button()).toBeInTheDocument();

      await user.keyboard("n");
      expect(api.queue.entries.find((e) => e.id === "a").answer).toBeNull();
      expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
    });

    it("a rolagem do próprio botão (suave, até o fim dela) não conta como chegar rolando", () => {
      globalThis.onscrollend = null;
      const scroller = answerLastInScroller();
      const card = screen.getByTestId("current-entry");
      const focus = vi.spyOn(card, "focus");
      fireEvent.click(button());
      // No meio da rolagem suave o topo do cartão já passa pela área visível: o botão espera o fim.
      scrollTo(scroller, 200);
      expect(button()).toBeInTheDocument();
      expect(focus).not.toHaveBeenCalled();
      act(() => { scroller.dispatchEvent(new Event("scrollend")); });
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(button()).toBeNull();
    });

    it("sem a pessoa rolar (o cartão parado), um scroll da própria âncora não tira o botão", () => {
      const scroller = answerLastInScroller();
      // Um scroll sem o cartão sair do lugar onde estava quando o botão apareceu.
      fireEvent.scroll(scroller);
      expect(button()).toBeInTheDocument();
    });

    // OBS-40 (fincla-api#507, decisão do Owner): num cartão alto, o topo pode ficar escondido
    // enquanto a fileira de respostas está inteira à vista. A pessoa vê o que vai responder: o
    // pendente conta como alcançado, e o 1º S/A/N responde direto.
    describe("OBS-40: a fileira de respostas do pendente à vista, com o topo do cartão escondido", () => {
      it("o 1º S responde o pendente (uma resposta só) e o botão some, sem rolar", async () => {
        const user = userEvent.setup();
        answerLastInScroller();
        // O topo do cartão 500 px acima da tela; as respostas em 220–252 px (área de 0 a 400).
        geo.answers = 720;
        expect(document.activeElement).toBe(button());

        await user.keyboard("s");

        expect(shortcutAnswers).toEqual([["a", "pair"]]);
        expect(api.queue.entries.find((e) => e.id === "a").answer).toBe("pair");
        expect(api.queue.entries.find((e) => e.id === "c").answer).toBeNull();
        expect(button()).toBeNull();
        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      });

      for (const [label, answersAt] of [["abaixo do fim da área visível", 880], ["cortada pelo fim da área visível", 380], ["sem medida", null]]) {
        it(`com a fileira de respostas ${label}, S faz o que o botão faz (leva, não responde)`, async () => {
          const user = userEvent.setup();
          answerLastInScroller();
          geo.answers = answersAt === null ? null : 500 + answersAt;

          await user.keyboard("s");

          expect(shortcutAnswers).toEqual([]);
          expect(api.queue.entries.find((e) => e.id === "a").answer).toBeNull();
          expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
        });
      }

      it("com o topo grudado cobrindo a fileira de respostas, S faz o que o botão faz", async () => {
        const user = userEvent.setup();
        const scroller = answerLastInScroller();
        // O topo grudado cobre até 80 px; as respostas em 60–92 px.
        scroller.dataset.stickyCover = "80";
        geo.answers = 560;

        await user.keyboard("s");

        expect(shortcutAnswers).toEqual([]);
        expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
      });

      it("rolando até a fileira de respostas ficar à vista (topo ainda escondido), o botão some sem mexer na rolagem", async () => {
        const user = userEvent.setup();
        const scroller = answerLastInScroller();
        // Topo em -200; a fileira 330 px abaixo dele: 130–162 px, à vista.
        geo.answers = 330;
        scrollTo(scroller, -200);
        const top = scroller.scrollTop;

        expect(button()).toBeNull();
        expect(scroller.scrollTop).toBe(top);
        expect(document.activeElement).toBe(screen.getByTestId("current-entry"));

        await user.keyboard("n");
        expect(shortcutAnswers).toEqual([["a", "ignore"]]);
        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      });

      it("rolando sem a fileira de respostas ficar à vista, o botão continua", () => {
        const scroller = answerLastInScroller();
        geo.answers = 600; // -200 + 600 = 400: começa no fim da área visível
        scrollTo(scroller, -200);
        expect(button()).toBeInTheDocument();
      });
    });
  });
});
