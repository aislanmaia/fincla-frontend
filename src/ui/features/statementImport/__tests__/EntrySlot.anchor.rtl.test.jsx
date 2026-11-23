/** @vitest-environment jsdom */
// BUG-01 (fincla-api#507, regra 5): ao minimizar, o item que a pessoa acabou de responder fica
// parado na tela. Dois casos fugiam: (a) no fim da lista a página encolhe e o navegador puxa a
// rolagem para trás; (b) o próximo sem resposta abre ACIMA e empurra a lista a cada quadro.
//
// jsdom não tem layout: aqui uma região que rola é simulada (alturas por estado do lugar, rolagem
// cortada como no navegador), e `Element.animate` é falso quando a animação importa.
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import { EntrySlot, pickAnchor, spacerNeeded } from "../entryQueue.jsx";

const OPEN = 500;
const ROW = 50;
const VIEW = 400;

let scroller;
let scrollTop = 0;
const slotHeight = (el) => (el.dataset.open === "true" ? OPEN : ROW);
const spacerOf = () => scroller?.querySelector("[data-testid='entry-anchor-spacer']") ?? null;
const contentHeight = () => [...scroller.querySelectorAll("[data-testid='entry-slot']")].reduce((sum, el) => sum + slotHeight(el), 0);
const scrollHeight = () => contentHeight() + (Number.parseFloat(spacerOf()?.style.height) || 0);
const clamp = () => { scrollTop = Math.max(0, Math.min(scrollTop, scrollHeight() - VIEW)); };

const realRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  scrollTop = 0;
  Element.prototype.getBoundingClientRect = function rect() {
    if (this.dataset?.testid !== "entry-slot" || !scroller?.contains(this)) return realRect.call(this);
    // Como o navegador: medir força o layout, e a rolagem é cortada se a página encolheu.
    clamp();
    let top = 0;
    for (const el of scroller.querySelectorAll("[data-testid='entry-slot']")) {
      if (el === this) break;
      top += slotHeight(el);
    }
    const height = slotHeight(this);
    return { top: top - scrollTop, bottom: top - scrollTop + height, height, left: 0, right: 0, width: 0, x: 0, y: top - scrollTop };
  };
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = realRect;
  delete Element.prototype.animate;
  vi.unstubAllGlobals();
  scroller = null;
});

function List({ open }) {
  return (
    <div
      data-testid="scroller"
      style={{ overflowY: "auto" }}
      ref={(el) => {
        if (!el || el === scroller) return;
        scroller = el;
        Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW });
        Object.defineProperty(el, "scrollHeight", { configurable: true, get: scrollHeight });
        Object.defineProperty(el, "scrollTop", { configurable: true, get: () => { clamp(); return scrollTop; }, set: (v) => { scrollTop = v; clamp(); } });
      }}
    >
      {["a", "b", "c"].map((id) => (
        <EntrySlot key={id} open={open === id}>
          {open === id
            ? <div data-testid={`card-${id}`}><button type="button">Confirmar {id}</button></div>
            : <div data-testid={`row-${id}`}><button type="button">Alterar {id}</button></div>}
        </EntrySlot>
      ))}
    </div>
  );
}

const slot = (id) => (screen.queryByTestId(`card-${id}`) ?? screen.getByTestId(`row-${id}`)).parentElement;
const topOf = (id) => slot(id).getBoundingClientRect().top;

describe("pickAnchor / spacerNeeded", () => {
  it("a âncora é o item com o foco; sem foco, o que recolheu — nunca o próximo que abriu sozinho", () => {
    const opened = { id: "next", collapsing: false, focusInside: false };
    const collapsed = { id: "answered", collapsing: true, focusInside: false };
    const clicked = { id: "clicked", collapsing: false, focusInside: true };
    expect(pickAnchor([opened, collapsed])).toBe(collapsed);
    expect(pickAnchor([collapsed, clicked])).toBe(clicked);
    expect(pickAnchor([opened])).toBeNull();
  });

  it("só pede espaço embaixo quando a rolagem não caberia na página mais curta", () => {
    expect(spacerNeeded({ target: 200, clientHeight: 400, contentHeight: 1000 })).toBe(0);
    expect(spacerNeeded({ target: 200, clientHeight: 400, contentHeight: 150 })).toBe(450);
    expect(spacerNeeded({ target: 0, clientHeight: 400, contentHeight: 150 })).toBe(0);
    expect(spacerNeeded({ target: 300.2, clientHeight: 400, contentHeight: 600 })).toBe(101);
  });
});

describe("EntrySlot: o item respondido fica parado (BUG-01)", () => {
  it("(a) o último da lista recolhe com a rolagem no fim: um espaço provisório segura a rolagem", () => {
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; }); // o fim: 50 + 50 + 500 − 400
    const before = topOf("c");
    screen.getByRole("button", { name: "Confirmar c" }).focus();

    rerender(<List open={null} />);

    expect(topOf("c")).toBe(before);
    expect(scroller.scrollTop).toBe(200);
    expect(spacerOf()).toHaveStyle({ height: "450px" });
    expect(spacerOf()).toHaveAttribute("aria-hidden", "true");
  });

  it("(a) o espaço provisório encolhe com a rolagem da pessoa e some quando não segura mais nada", () => {
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; });
    rerender(<List open={null} />);
    expect(spacerOf()).toHaveStyle({ height: "450px" });

    // Rolar para cima: a página mais curta já cabe, nada pula ao soltar.
    act(() => {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event("scroll"));
    });

    expect(spacerOf()).toBeNull();
    expect(scroller.scrollTop).toBe(0);
  });

  it("(b) o próximo sem resposta abre ACIMA: ele abre na hora (sem animar a altura) e a rolagem compensa", () => {
    const animations = [];
    Element.prototype.animate = vi.fn(function animate(keyframes) {
      const a = { onfinish: null, oncancel: null, cancel: vi.fn() };
      animations.push({ el: this, keyframes, a });
      return a;
    });
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; });
    const before = topOf("c");
    screen.getByRole("button", { name: "Confirmar c" }).focus();

    rerender(<List open="a" />);

    // O "a" cresceu 450 px acima: a rolagem andou 450 e o "c" não saiu do lugar.
    expect(topOf("c")).toBe(before);
    expect(scroller.scrollTop).toBe(650);
    const heightOf = (el) => animations.filter((x) => x.el === el && x.keyframes[0].height !== undefined);
    expect(heightOf(slot("a"))).toEqual([]);
    expect(heightOf(slot("c"))).toHaveLength(1);
  });

  it("o próximo abre ABAIXO: a rolagem não mexe e os dois animam", () => {
    const animations = [];
    Element.prototype.animate = vi.fn(function animate(keyframes) {
      const a = { onfinish: null, oncancel: null, cancel: vi.fn() };
      animations.push({ el: this, keyframes, a });
      return a;
    });
    const { rerender } = render(<List open="a" />);
    const before = topOf("a");
    screen.getByRole("button", { name: "Confirmar a" }).focus();

    rerender(<List open="b" />);

    expect(topOf("a")).toBe(before);
    expect(scroller.scrollTop).toBe(0);
    expect(spacerOf()).toBeNull();
    const heights = animations.filter((x) => x.keyframes[0].height !== undefined).map((x) => x.el);
    expect(heights).toEqual(expect.arrayContaining([slot("a"), slot("b")]));
  });

  it("sem foco em nenhum (resposta que voltou depois do PATCH), a âncora é o que recolheu, não o que abriu", () => {
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; });
    const before = topOf("c");
    document.body.focus();

    rerender(<List open="a" />);

    expect(topOf("c")).toBe(before);
  });

  it("com movimento reduzido não anima nada, mas a âncora vale igual", () => {
    Element.prototype.animate = vi.fn(() => ({ cancel() {} }));
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; });
    const before = topOf("c");

    rerender(<List open="a" />);

    expect(Element.prototype.animate).not.toHaveBeenCalled();
    expect(topOf("c")).toBe(before);
  });

  it("sair do passo (a lista desmonta) tira o espaço provisório", () => {
    const { rerender, unmount } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 200; });
    rerender(<List open={null} />);
    const host = scroller;
    expect(spacerOf()).not.toBeNull();

    unmount();

    expect(host.querySelector("[data-testid='entry-anchor-spacer']")).toBeNull();
  });
});
