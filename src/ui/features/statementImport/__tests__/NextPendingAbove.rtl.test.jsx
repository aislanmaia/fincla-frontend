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

import { CurrentEntryFrame, EntrySlot, useEntryQueue } from "../entryQueue.jsx";

const INITIAL = [
  { id: "a", date: "2026-10-03", bank_description: "PIX ENVIADO MERCADO", answer: null },
  { id: "b", date: "2026-10-05", bank_description: "TED RECEBIDA", answer: "ignore" },
  { id: "c", date: "2026-10-07", bank_description: "PAGTO BOLETO LUZ", answer: null },
  { id: "d", date: "2026-10-09", bank_description: "TARIFA PACOTE", answer: null },
];

let api;

function Harness({ initial = INITIAL }) {
  const [entries, setEntries] = useState(initial);
  const queue = useEntryQueue("doubts", entries);
  const answer = (id, value = "ignore") => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, answer: value } : e)));
    queue.advanceFrom(id);
  };
  api = { queue, answer, setEntries };
  return (
    <div>
      {entries.map((entry) => (
        <EntrySlot key={entry.id} open={entry.id === queue.currentId} queue={queue} entryId={entry.id}>
          {entry.id === queue.currentId ? (
            <CurrentEntryFrame queue={queue} entry={entry}>
              <div data-testid={`card-${entry.id}`}>
                <button type="button" onClick={() => answer(entry.id)}>Não registrar {entry.id}</button>
                <input aria-label={`campo ${entry.id}`} />
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
});
