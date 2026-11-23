/** @vitest-environment jsdom */
// BUG-01 (fincla-api#507, regra 5): ao minimizar, o item que a pessoa acabou de responder fica
// parado na tela. Dois casos fugiam: (a) no fim da lista a página encolhe e o navegador puxa a
// rolagem para trás; (b) o próximo sem resposta abre ACIMA e empurra a lista a cada quadro.
// BUG-08: com o cartão mais alto que a tela (o topo dele já fora da vista), manter o topo deixava
// a linha fora da tela e só espaço vazio à vista. BUG-09: o "Tudo respondido neste passo" que
// aparece no cabeçalho, acima da lista, empurrava o item.
//
// jsdom não tem layout: aqui uma região que rola é simulada (alturas por estado do lugar, rolagem
// cortada como no navegador), e `Element.animate` é falso quando a animação importa.
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  ANCHOR_MARGIN,
  CurrentEntryFrame,
  EntryQueueHeader,
  EntrySlot,
  SETTLE_SPACER_RATIO,
  anchorTarget,
  pickAnchor,
  spacerNeeded,
  useEntryQueue,
} from "../entryQueue.jsx";

let ROW = 100;
let VIEW = 400;
const HEADER = 52;
const NOTE = 24;
const IDS = ["a", "b", "c", "d", "e", "f"];
let openHeight = 300;

let scroller;
let scrollTop = 0;
const measured = (root = scroller) => [...root.querySelectorAll("[data-testid='queue-header'], [data-testid='entry-slot']")];
// O Chrome corta a rolagem na medida, mas guarda a antiga: se a página volta a crescer (a animação
// começa da altura antiga), a rolagem antiga volta; e pôr de novo o valor já cortado não faz nada.
let chromeLike = false;
const heightOf = (el) => {
  if (el.dataset.animHeight) return Number(el.dataset.animHeight);
  if (el.dataset.testid === "queue-header") return HEADER + (el.querySelector("[role='note']") ? NOTE : 0);
  return el.dataset.open === "true" ? openHeight : ROW;
};
const spacerOf = () => scroller?.querySelector("[data-testid='entry-anchor-spacer']") ?? null;
const spacerHeight = () => Number.parseFloat(spacerOf()?.style.height) || 0;
const contentHeight = () => measured().reduce((sum, el) => sum + heightOf(el), 0);
const scrollHeight = () => contentHeight() + spacerHeight();
const maxScroll = () => Math.max(0, scrollHeight() - VIEW);
const clamp = () => { if (!scroller || chromeLike) return; scrollTop = Math.max(0, Math.min(scrollTop, maxScroll())); };
const readScroll = () => { clamp(); return chromeLike ? Math.min(scrollTop, maxScroll()) : scrollTop; };
const writeScroll = (v) => {
  if (chromeLike && v === Math.min(scrollTop, maxScroll())) return;
  scrollTop = Math.max(0, Math.min(v, maxScroll()));
};

const realRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  scrollTop = 0;
  openHeight = 300;
  ROW = 100;
  VIEW = 400;
  chromeLike = false;
  Element.prototype.getBoundingClientRect = function rect() {
    const kind = this.dataset?.testid;
    // A moldura do cartão aberto ocupa o lugar dele inteiro.
    if (kind === "current-entry" && this.parentElement?.dataset.testid === "entry-slot") return this.parentElement.getBoundingClientRect();
    // A região pelo DOM (o `ref` dela ainda não chegou na 1ª medida do cabeçalho, ao montar).
    const root = this.closest?.("[data-testid='scroller']");
    if ((kind !== "entry-slot" && kind !== "queue-header") || !root) return realRect.call(this);
    // Como o navegador: medir força o layout, e a rolagem é cortada se a página encolheu.
    clamp();
    let top = 0;
    for (const el of measured(root)) {
      if (el === this) break;
      top += heightOf(el);
    }
    const height = heightOf(this);
    const st = readScroll();
    return { top: top - st, bottom: top - st + height, height, left: 0, right: 0, width: 0, x: 0, y: top - st };
  };
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = realRect;
  delete Element.prototype.animate;
  vi.unstubAllGlobals();
  scroller = null;
});

const fakeQueue = ({ open, pending }) => ({
  total: IDS.length,
  pending,
  answeredCount: IDS.length - pending,
  hidden: 0,
  filter: "all",
  currentId: open,
  position: open ? IDS.indexOf(open) + 1 : 0,
  setFilter: () => {},
});

function List({ open, header = false, pending = 1 }) {
  return (
    <div
      data-testid="scroller"
      style={{ overflowY: "auto" }}
      ref={(el) => {
        if (!el || el === scroller) return;
        scroller = el;
        Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW });
        Object.defineProperty(el, "scrollHeight", { configurable: true, get: scrollHeight });
        Object.defineProperty(el, "scrollTop", { configurable: true, get: readScroll, set: writeScroll });
      }}
    >
      {header ? <EntryQueueHeader queue={fakeQueue({ open, pending })} /> : null}
      {IDS.map((id) => (
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
/** Quanto da área visível tem conteúdo (não espaço provisório). */
const visibleContent = () => Math.max(0, Math.min(VIEW, contentHeight() - readScroll()));
const scrollToEnd = () => act(() => { scroller.scrollTop = scrollHeight() - VIEW; });
const fakeAnimate = () => {
  const animations = [];
  Element.prototype.animate = vi.fn(function animate(keyframes) {
    const a = { onfinish: null, oncancel: null, cancel: vi.fn() };
    // A altura animada vale já no primeiro quadro (como no navegador), até a animação acabar.
    if (keyframes[0].height !== undefined) {
      this.dataset.animHeight = Number.parseFloat(keyframes[0].height);
      a.finish = () => { delete this.dataset.animHeight; a.onfinish?.(); };
    }
    animations.push({ el: this, keyframes, a });
    return a;
  });
  return animations;
};

describe("pickAnchor / spacerNeeded / anchorTarget", () => {
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

  it("topo à vista: fica onde estava, mesmo pedindo espaço embaixo", () => {
    expect(anchorTarget({ scrollTop: 400, oldTop: 100, newTop: 100, newHeight: 50, viewTop: 0, clientHeight: 400, contentHeight: 600 })).toBe(400);
    expect(anchorTarget({ scrollTop: 0, oldTop: 120, newTop: 300, newHeight: 50, viewTop: 0, clientHeight: 400, contentHeight: 2000 })).toBe(180);
  });

  it("topo um pouco acima (atrás do topo grudado), mas a linha ainda aparece ali: fica onde estava, sem pulo", () => {
    // Computador: o topo do cartão 28 px atrás do topo grudado; a linha de 80 px no mesmo topo aparece.
    expect(anchorTarget({ scrollTop: 539, oldTop: 144, newTop: 144, newHeight: 80, viewTop: 172, clientHeight: 844, contentHeight: 1000 })).toBe(539);
  });

  it("BUG-11: a metade é medida contra a borda do topo grudado, não contra a folga de foco do scroll-padding", () => {
    // Medido no navegador (computador 1440x900, página no fim, rolagem 539 de 539): a região que
    // rola começa em 56 px, o topo grudado tem 104 px (cobre até 160 px) e o scroll-padding-top
    // soma a folga de foco de 12 px (116 px: 172 px). O topo do cartão está em 144,1875 px. Na
    // hora de recolher, a linha ainda é a de antes da releitura do rascunho: 44 px (depois cresce
    // para 80 px, para baixo). Abaixo de 160 px aparecem 28,2 dos 44 px (64%): fica parada.
    const bug11 = { scrollTop: 539, oldTop: 144.1875, newTop: 144.1875, newHeight: 44, viewTop: 172, clientHeight: 728, contentHeight: 689 };
    expect(anchorTarget({ ...bug11, coverTop: 160 })).toBe(539);
    // Medida contra 172 px (a folga de foco contada como coberta), a metade dava 166,2 ≤ 172,5 e a
    // linha ia para a vista: o pulo de 581 px do BUG-11.
    expect(anchorTarget(bug11)).not.toBe(539);
    // Com a linha já na altura final (80 px), também fica.
    expect(anchorTarget({ ...bug11, newHeight: 80, coverTop: 160 })).toBe(539);
    // Menos da metade abaixo da borda (21 de 44 px): a linha vem para a vista, como no BUG-10.
    expect(anchorTarget({ ...bug11, oldTop: 137, newTop: 137, coverTop: 160 })).not.toBe(539);
  });

  it("só uma fresta da linha apareceria atrás do topo grudado (BUG-10): ela vem para a área visível", () => {
    // Celular: cartão alto centralizado, topo 1 px acima da tela, área visível a partir de 123 px;
    // a linha de 126 px no mesmo topo mostraria 2 px. No fim da lista, a rolagem para no fim do conteúdo.
    expect(anchorTarget({ scrollTop: 1597, oldTop: -1, newTop: -1, newHeight: 126, viewTop: 123, clientHeight: 844, contentHeight: 2200 })).toBe(2200 - 844);
    // No meio da lista: a linha vai para o topo da área visível (com a folga).
    expect(anchorTarget({ scrollTop: 1597, oldTop: -1, newTop: -1, newHeight: 126, viewTop: 123, clientHeight: 844, contentHeight: 6000 })).toBe(1597 - 1 - 123 - ANCHOR_MARGIN);
  });

  it("topo acima da tela: a linha vem para o topo da área visível; no fim da lista, a rolagem para no fim do conteúdo", () => {
    // No meio da lista: há conteúdo embaixo, a linha fica no topo (com a folga).
    expect(anchorTarget({ scrollTop: 800, oldTop: -300, newTop: -300, viewTop: 0, clientHeight: 400, contentHeight: 3000 })).toBe(500 - ANCHOR_MARGIN);
    // No fim: levar a linha ao topo deixaria vazio embaixo; a rolagem fica no fim do conteúdo.
    expect(anchorTarget({ scrollTop: 800, oldTop: -300, newTop: -300, viewTop: 0, clientHeight: 400, contentHeight: 700 })).toBe(300);
    // A área visível começa mais abaixo na tela (região que rola dentro do app).
    expect(anchorTarget({ scrollTop: 800, oldTop: 50, newTop: 50, viewTop: 120, clientHeight: 400, contentHeight: 3000 })).toBe(800 + 50 - 120 - ANCHOR_MARGIN);
    // Nunca abaixo de zero.
    expect(anchorTarget({ scrollTop: 10, oldTop: -50, newTop: -50, viewTop: 0, clientHeight: 400, contentHeight: 200 })).toBe(0);
  });
});

describe("EntrySlot: o item respondido fica parado (BUG-01)", () => {
  it("(a) o último da lista recolhe com a rolagem no fim: um espaço provisório segura a rolagem", () => {
    const { rerender } = render(<List open="f" />);
    scrollToEnd(); // 5 × 100 + 300 − 400
    expect(scrollTop).toBe(400);
    const before = topOf("f");
    expect(before).toBe(100); // o topo do cartão à vista
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open={null} />);

    expect(topOf("f")).toBe(before);
    expect(scroller.scrollTop).toBe(400);
    expect(spacerOf()).toHaveStyle({ height: "200px" });
    expect(spacerOf()).toHaveAttribute("aria-hidden", "true");
  });

  it("BUG-12 (Conferir o saldo): enquanto a linha anima (cresce com o Próximo pendente embaixo), a ancoragem do navegador fica desligada; volta no fim", () => {
    // Sem espaço provisório (a rolagem cabe), a âncora soltava a ancoragem antes de a animação
    // começar; com conteúdo abaixo da lista, o navegador rolava junto com o crescimento e a
    // linha subia 45 px depois de recolher.
    const animations = fakeAnimate();
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 150; });
    screen.getByRole("button", { name: "Confirmar c" }).focus();

    rerender(<List open="d" />);

    const growing = animations.filter((x) => x.keyframes[0].height !== undefined);
    expect(growing.length).toBeGreaterThan(0);
    expect(spacerOf()).toBeNull();
    expect(scroller.style.overflowAnchor).toBe("none");
    act(() => { for (const x of growing) x.a.finish(); });
    expect(scroller.style.overflowAnchor).toBe("");
  });

  it("(a) o espaço provisório encolhe com a rolagem da pessoa e some quando não segura mais nada", () => {
    const { rerender } = render(<List open="f" />);
    scrollToEnd();
    rerender(<List open={null} />);
    expect(spacerOf()).toHaveStyle({ height: "200px" });

    act(() => {
      scroller.scrollTop = 300;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(spacerOf()).toHaveStyle({ height: "100px" });

    // Rolar mais para cima: a página mais curta já cabe, nada pula ao soltar.
    act(() => {
      scroller.scrollTop = 100;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(spacerOf()).toBeNull();
    expect(scroller.scrollTop).toBe(100);
  });

  it("(b) o próximo sem resposta abre ACIMA: ele abre na hora (sem animar a altura) e a rolagem compensa", () => {
    const animations = fakeAnimate();
    const { rerender } = render(<List open="f" />);
    scrollToEnd();
    const before = topOf("f");
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open="a" />);

    // O "a" cresceu 200 px acima: a rolagem andou 200 e o "f" não saiu do lugar.
    expect(topOf("f")).toBe(before);
    expect(scroller.scrollTop).toBe(600);
    const heights = (el) => animations.filter((x) => x.el === el && x.keyframes[0].height !== undefined);
    expect(heights(slot("a"))).toEqual([]);
    expect(heights(slot("f"))).toHaveLength(1);
  });

  it("o próximo abre ABAIXO: a rolagem não mexe e os dois animam", () => {
    const animations = fakeAnimate();
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
    const { rerender } = render(<List open="f" />);
    scrollToEnd();
    const before = topOf("f");
    document.body.focus();

    rerender(<List open="a" />);

    expect(topOf("f")).toBe(before);
  });

  it("com movimento reduzido não anima nada, mas a âncora vale igual", () => {
    Element.prototype.animate = vi.fn(() => ({ cancel() {} }));
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<List open="f" />);
    scrollToEnd();
    const before = topOf("f");

    rerender(<List open="a" />);

    expect(Element.prototype.animate).not.toHaveBeenCalled();
    expect(topOf("f")).toBe(before);
  });

  it("sair do passo (a lista desmonta) tira o espaço provisório", () => {
    const { rerender, unmount } = render(<List open="f" />);
    scrollToEnd();
    rerender(<List open={null} />);
    const host = scroller;
    expect(spacerOf()).not.toBeNull();

    unmount();

    expect(host.querySelector("[data-testid='entry-anchor-spacer']")).toBeNull();
  });
});

describe("cartão mais alto que a tela (BUG-08): a pessoa sempre vê a linha respondida", () => {
  it("o último, com a página no fim e o topo do cartão acima da tela: a linha e a lista à vista, sem espaço vazio", () => {
    openHeight = 900;
    fakeAnimate();
    const { rerender } = render(<List open="f" />);
    scrollToEnd(); // 5 × 100 + 900 − 400
    expect(topOf("f")).toBe(-500); // o topo do cartão fora da tela; a pessoa vê os botões
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open={null} />);

    // A rolagem para no fim do conteúdo: nada de espaço provisório, a tela inteira com conteúdo.
    expect(spacerOf()).toBeNull();
    expect(visibleContent()).toBe(VIEW);
    // A linha "Conferido" inteira à vista, na parte da tela onde estava o cartão, e a lista acima.
    expect(topOf("f")).toBeGreaterThanOrEqual(0);
    expect(topOf("f") + ROW).toBeLessThanOrEqual(VIEW);
    expect(topOf("e")).toBeGreaterThanOrEqual(0);
  });

  it("com a animação começando da altura antiga (Chrome devolve a rolagem cortada), a linha não escorrega quadro a quadro", () => {
    openHeight = 900;
    chromeLike = true;
    const animations = fakeAnimate();
    const { rerender } = render(<List open="f" />);
    act(() => { scroller.scrollTop = 1000; });
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open={null} />);

    // Primeiro quadro: o lugar ainda alto (900), a rolagem já no alvo final.
    const settled = topOf("f");
    expect(slot("f").dataset.animHeight).toBe("900");
    expect(scroller.scrollTop).toBe(200); // o fim do conteúdo final (5 × 100 + 100 − 400)
    expect(settled).toBe(300);
    // Fim da animação: nada se move.
    act(() => { for (const { a } of animations) a.finish?.(); });
    expect(topOf("f")).toBe(settled);
    expect(visibleContent()).toBe(VIEW);
  });

  it("rolar depois não cai em espaço vazio: para baixo não há mais nada, para cima a lista continua", () => {
    openHeight = 900;
    const { rerender } = render(<List open="f" />);
    scrollToEnd();
    rerender(<List open={null} />);
    const end = scroller.scrollTop;

    act(() => { scroller.scrollTop = end + 300; scroller.dispatchEvent(new Event("scroll")); });
    expect(scroller.scrollTop).toBe(end);
    expect(visibleContent()).toBe(VIEW);
    act(() => { scroller.scrollTop = end - 150; scroller.dispatchEvent(new Event("scroll")); });
    expect(visibleContent()).toBe(VIEW);
    expect(spacerOf()).toBeNull();
  });

  it("no meio da lista (o próximo abre abaixo): a linha vem para o topo da área visível, com o próximo embaixo", () => {
    openHeight = 900;
    const { rerender } = render(<List open="c" />);
    act(() => { scroller.scrollTop = 900; }); // o topo do "c" (200) bem acima da tela; vê-se o fim dele
    expect(topOf("c")).toBe(-700);
    screen.getByRole("button", { name: "Confirmar c" }).focus();

    rerender(<List open="d" />);

    expect(topOf("c")).toBe(ANCHOR_MARGIN);
    expect(topOf("d")).toBe(ANCHOR_MARGIN + ROW);
    expect(visibleContent()).toBe(VIEW);
  });

  it("com um topo grudado na região (scroll-padding-top), a linha vem para logo abaixo dele", () => {
    openHeight = 900;
    const { rerender } = render(<List open="c" />);
    scroller.style.scrollPaddingTop = "60px";
    act(() => { scroller.scrollTop = 900; });
    screen.getByRole("button", { name: "Confirmar c" }).focus();

    rerender(<List open="d" />);

    expect(topOf("c")).toBe(60 + ANCHOR_MARGIN);
  });

  it("BUG-11: o topo grudado publica a borda que cobre; 28 dos 44 px da linha à vista abaixo dela: a linha fica parada (0 px)", () => {
    // A geometria do BUG-11 nesta região simulada: linha de 44 px (a altura na hora de recolher),
    // cartão de 670 px, área de 728 px, página no fim. O topo do "f" fica em 58 px; o topo grudado
    // cobre até 74 px (data-sticky-cover) e o scroll-padding-top soma a folga de foco (86 px).
    ROW = 44;
    VIEW = 728;
    openHeight = 670;
    const { rerender } = render(<List open="f" />);
    scroller.dataset.stickyCover = "74";
    scroller.style.scrollPaddingTop = "86px";
    scrollToEnd();
    expect(topOf("f")).toBe(58);
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open={null} />);

    expect(topOf("f")).toBe(58);
    expect(spacerHeight()).toBeGreaterThan(0);
  });

  // BUG-12 (computador 1440x900): a linha recolhida final mede 80 px; o topo grudado cobre até
  // 74 px desta região (160 px da tela no navegador). Topo do cartão X px atrás dessa borda: fica
  // parada se pelo menos metade da linha (40 px) continua à vista; senão vem para a vista.
  const QA_OFFSETS = [16, 20, 24, 30, 36, 40, 60];
  const stays = (offset) => 80 - offset >= 40;

  it("BUG-12: regra da metade com a geometria do QA (linha final de 80 px), direto no cálculo", () => {
    for (const offset of QA_OFFSETS) {
      const oldTop = 160 - offset;
      const geometry = { scrollTop: 500, oldTop, newTop: oldTop, newHeight: 80, viewTop: 172, coverTop: 160, clientHeight: 844, contentHeight: 3000 };
      if (stays(offset)) expect(anchorTarget(geometry), `${offset} px`).toBe(500);
      else expect(anchorTarget(geometry), `${offset} px`).toBe(500 + oldTop - (172 + ANCHOR_MARGIN));
    }
  });

  for (const offset of QA_OFFSETS) {
    it(`BUG-12, fim da página: topo do cartão ${offset} px atrás do topo grudado → ${stays(offset) ? "fica parada (0 px)" : "vem para a vista"}`, () => {
      ROW = 80;
      VIEW = 728;
      // O cartão do último ("f") mais alto que a tela, com a página no fim: o topo dele fica X px
      // acima da borda do topo grudado (74 px).
      openHeight = 654 + offset;
      const { rerender } = render(<List open="f" />);
      scroller.dataset.stickyCover = "74";
      scroller.style.scrollPaddingTop = "86px";
      scrollToEnd();
      const before = topOf("f");
      expect(before).toBe(74 - offset);
      screen.getByRole("button", { name: "Confirmar f" }).focus();

      rerender(<List open={null} />);

      const after = topOf("f");
      if (stays(offset)) {
        expect(after).toBe(before);
      } else {
        // Inteira à vista abaixo do topo grudado, com conteúdo na tela.
        expect(after).toBeGreaterThanOrEqual(74);
        expect(after + 80).toBeLessThanOrEqual(VIEW);
        expect(visibleContent()).toBeGreaterThan(0);
      }
    });

    it(`BUG-12, meio da lista (o próximo abre abaixo): ${offset} px atrás → ${stays(offset) ? "fica parada (0 px)" : "vem para logo abaixo do topo grudado"}`, () => {
      ROW = 80;
      VIEW = 728;
      openHeight = 670;
      const { rerender } = render(<List open="c" />);
      scroller.dataset.stickyCover = "74";
      scroller.style.scrollPaddingTop = "86px";
      // "c" começa em 160 px do conteúdo (a e b recolhidas).
      act(() => { scroller.scrollTop = 160 - 74 + offset; });
      const before = topOf("c");
      expect(before).toBe(74 - offset);
      screen.getByRole("button", { name: "Confirmar c" }).focus();

      rerender(<List open="d" />);

      expect(topOf("c")).toBe(stays(offset) ? before : 86 + ANCHOR_MARGIN);
    });
  }

  it("o caso do BUG-01 (topo à vista) continua exatamente parado, mesmo com o cartão alto", () => {
    openHeight = 380;
    const { rerender } = render(<List open="f" />);
    act(() => { scroller.scrollTop = 480; }); // topo do "f" em 20, à vista
    const before = topOf("f");
    expect(before).toBe(20);
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<List open={null} />);

    expect(topOf("f")).toBe(before);
    expect(visibleContent()).toBeGreaterThan(0);
  });
});

describe("'Tudo respondido neste passo' no cabeçalho (BUG-09): o item respondido não desce", () => {
  it("a linha aparece depois (a releitura do rascunho, outro commit): a rolagem compensa e o item fica parado", () => {
    const { rerender } = render(<List open="c" header pending={1} />);
    act(() => { scroller.scrollTop = 100; });
    screen.getByRole("button", { name: "Confirmar c" }).focus();
    const before = topOf("c");

    rerender(<List open={null} header pending={1} />);
    expect(topOf("c")).toBe(before);

    // O backend confirma: não falta nenhum, e o cabeçalho ganha "Tudo respondido neste passo".
    rerender(<List open={null} header pending={0} />);

    expect(screen.getByRole("note")).toHaveTextContent("Tudo respondido neste passo");
    expect(topOf("c")).toBe(before);
  });

  it("a linha aparece com o último ainda recolhendo (a animação no meio): o espaço segura a altura final e nada desce no fim", () => {
    const animations = fakeAnimate();
    const { rerender } = render(<List open="f" header pending={1} />);
    scrollToEnd();
    screen.getByRole("button", { name: "Confirmar f" }).focus();
    const before = topOf("f");

    rerender(<List open={null} header pending={1} />);
    expect(slot("f").dataset.animHeight).toBe(String(openHeight));
    rerender(<List open={null} header pending={0} />);
    expect(topOf("f")).toBe(before);

    act(() => { for (const { a } of animations) a.finish?.(); });
    expect(topOf("f")).toBe(before);
  });

  it("a linha aparece no mesmo commit em que o cartão recolhe: compensa uma vez só", () => {
    const { rerender } = render(<List open="c" header pending={1} />);
    act(() => { scroller.scrollTop = 100; });
    screen.getByRole("button", { name: "Confirmar c" }).focus();
    const before = topOf("c");

    rerender(<List open={null} header pending={0} />);

    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(topOf("c")).toBe(before);
  });

  it("mexer no próprio cabeçalho (o filtro) não rola a lista: quem fica parado é ele", () => {
    const { rerender } = render(<List open={null} header pending={1} />);
    act(() => { scroller.scrollTop = 100; });
    screen.getAllByRole("button")[0].focus();
    expect(screen.getByTestId("queue-header")).toContainElement(document.activeElement);

    rerender(<List open={null} header pending={0} />);

    expect(scroller.scrollTop).toBe(100);
  });

  it("com a página no topo, a rolagem ganha o espaço que faltar para o item não descer", () => {
    const { rerender } = render(<List open={null} header pending={1} />);
    const before = topOf("a");

    rerender(<List open={null} header pending={0} />);

    expect(topOf("a")).toBe(before);
    expect(scroller.scrollTop).toBe(NOTE);
  });
});

// OBS-26 (fincla-api#507, decisão do Owner): no fim da lista, segurar o item respondido parado
// pode exigir um espaço provisório enorme embaixo (a tela vira um vão vazio). Acima de 40% da
// altura visível da região, a página não segura: assenta no fim do conteúdo, com rolagem suave
// (na hora com movimento reduzido). Até 40%, segura como antes.
describe("OBS-26: espaço provisório grande demais → a página assenta no fim do conteúdo", () => {
  let frames;
  let scrollToCalls;
  const flushFrames = () => act(() => { for (const cb of frames.splice(0)) cb(0); });

  beforeEach(() => {
    frames = [];
    scrollToCalls = [];
    vi.stubGlobal("requestAnimationFrame", (cb) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", (id) => { frames[id - 1] = () => {}; });
  });

  /** A lista simulada, com `scrollTo` registrando o pedido (quem anda a rolagem é o teste). */
  function SimList(props) {
    return (
      <div
        ref={(el) => {
          if (el) el.firstElementChild.scrollTo = (options) => scrollToCalls.push(options);
        }}
      >
        <List {...props} />
      </div>
    );
  }

  /** A rolagem suave andando até `top`: `scroll` em cada passo, como no navegador. */
  const scrollThrough = (...tops) => act(() => {
    for (const top of tops) {
      scroller.scrollTop = top;
      scroller.dispatchEvent(new Event("scroll"));
    }
  });

  it("a regra é 40% da altura visível", () => {
    expect(SETTLE_SPACER_RATIO).toBe(0.4);
  });

  it("espaço > 40%: o quadro da troca ainda segura (nada pula); depois a página rola suave até o fim do conteúdo, sem vão", () => {
    // 5 × 100 + 300 − 400: o "f" no fim; segurá-lo pediria 200 px (50% de 400) embaixo.
    const { rerender } = render(<SimList open="f" />);
    scrollToEnd();
    const before = topOf("f");
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<SimList open={null} />);

    // O primeiro quadro: o item no lugar, nada de pulo.
    expect(topOf("f")).toBe(before);
    expect(spacerHeight()).toBe(200);
    expect(scrollToCalls).toEqual([]);

    flushFrames();

    // O fim do conteúdo final: 6 × 100 − 400.
    expect(scrollToCalls).toEqual([{ top: 200, behavior: "smooth" }]);
    scrollThrough(300, 200);
    expect(spacerOf()).toBeNull();
    expect(visibleContent()).toBe(VIEW);
    // A linha respondida inteira à vista, no fim da tela, com a lista acima dela.
    expect(topOf("f")).toBe(VIEW - ROW);
  });

  it("com movimento reduzido, a página vai na hora para o fim do conteúdo", () => {
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<SimList open="f" />);
    scrollToEnd();
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<SimList open={null} />);
    flushFrames();

    expect(scrollToCalls).toEqual([{ top: 200, behavior: "instant" }]);
  });

  it("espaço ≤ 40%: segura o item parado como antes (sem rolar até o fim)", () => {
    // Cartão de 260 px: segurar o "f" pede 160 px embaixo, exatamente 40% de 400.
    openHeight = 260;
    const { rerender } = render(<SimList open="f" />);
    scrollToEnd();
    const before = topOf("f");
    const top = scroller.scrollTop;
    screen.getByRole("button", { name: "Confirmar f" }).focus();

    rerender(<SimList open={null} />);
    flushFrames();

    expect(scrollToCalls).toEqual([]);
    expect(scroller.scrollTop).toBe(top);
    expect(topOf("f")).toBe(before);
    expect(spacerHeight()).toBe(160);
  });

  // A página assentando sozinha não é "a pessoa chegou ao pendente rolando": o "↑ Próximo
  // pendente" continua (quem tira é a pessoa: clicar, rolar, responder).
  describe("a rolagem da própria tela não tira o 'Próximo pendente'", () => {
    // Cabeçalho de 52 px, o pendente "a" no topo, "b" respondido e "f" (o último) aberto.
    // Região de 600 px; o cartão de "a" mede 380 px quando abre e o de "f" também.
    const ENTRIES = [
      { id: "a", answer: null },
      { id: "b", answer: "ignore" },
      { id: "f", answer: null },
    ];
    let api;

    function QueueHarness() {
      const [entries, setEntries] = useState(ENTRIES);
      const queue = useEntryQueue("doubts", entries);
      api = { queue };
      const answer = (id) => {
        setEntries((list) => list.map((e) => (e.id === id ? { ...e, answer: "ignore" } : e)));
        queue.advanceFrom(id);
      };
      return (
        <div
          data-testid="scroller"
          style={{ overflowY: "auto" }}
          ref={(el) => {
            if (!el || el === scroller) return;
            scroller = el;
            Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW });
            Object.defineProperty(el, "scrollHeight", { configurable: true, get: scrollHeight });
            Object.defineProperty(el, "scrollTop", { configurable: true, get: readScroll, set: writeScroll });
            el.scrollTo = (options) => scrollToCalls.push(options);
          }}
        >
          <div data-testid="queue-header" />
          {entries.map((entry) => (
            <EntrySlot key={entry.id} open={entry.id === queue.currentId} queue={queue} entryId={entry.id}>
              {entry.id === queue.currentId ? (
                <CurrentEntryFrame queue={queue} entry={entry}>
                  <button type="button" onClick={() => answer(entry.id)}>Não registrar {entry.id}</button>
                </CurrentEntryFrame>
              ) : (
                <div data-testid={`row-${entry.id}`} />
              )}
            </EntrySlot>
          ))}
        </div>
      );
    }

    const nextButton = () => screen.queryByTestId("next-pending-above");
    const cardTop = () => screen.getByTestId("current-entry").getBoundingClientRect().top;

    /** Responde o último ("f", com a página no fim): o "a" abre acima e o botão aparece embaixo. */
    function answerLast() {
      VIEW = 600;
      openHeight = 380;
      render(<QueueHarness />);
      act(() => api.queue.open("f"));
      scrollToEnd(); // 52 + 100 + 100 + 380 − 600
      expect(scroller.scrollTop).toBe(32);
      const confirm = screen.getByRole("button", { name: "Não registrar f" });
      confirm.focus();
      fireEvent.click(confirm);
      expect(api.queue.currentId).toBe("a");
      expect(nextButton()).toBeInTheDocument();
      // Segurar o "f" pediria 280 px embaixo (> 40% de 600): a página vai assentar no fim.
      expect(spacerHeight()).toBe(280);
      expect(cardTop()).toBeLessThan(0);
      flushFrames();
      expect(scrollToCalls).toEqual([{ top: 32, behavior: "smooth" }]);
    }

    it("o topo do pendente entra na área visível durante a rolagem da tela: o botão continua", () => {
      answerLast();
      scrollThrough(200, 100, 32);
      // O topo do cartão "a" agora está à vista (e se moveu desde que o botão apareceu).
      expect(cardTop()).toBe(20);
      expect(nextButton()).toBeInTheDocument();
      flushFrames();
      expect(nextButton()).toBeInTheDocument();
    });

    it("depois de assentar, a pessoa rolando conta de novo (o estado da rolagem da tela não fica preso)", () => {
      answerLast();
      scrollThrough(100, 32);
      flushFrames();
      expect(nextButton()).toBeInTheDocument();
      act(() => { document.dispatchEvent(new Event("wheel")); });
      scrollThrough(31);
      expect(nextButton()).toBeNull();
    });

    it("a pessoa interrompe a rolagem da tela (roda do mouse): a rolagem dela conta na hora", () => {
      answerLast();
      scrollThrough(250);
      act(() => { document.dispatchEvent(new Event("wheel")); });
      scrollThrough(40);
      expect(nextButton()).toBeNull();
    });

    for (const type of ["touchstart", "keydown", "pointerdown"]) {
      it(`a pessoa interrompe a rolagem da tela (${type}): a rolagem dela conta na hora`, () => {
        answerLast();
        scrollThrough(250);
        act(() => { document.body.dispatchEvent(new Event(type, { bubbles: true })); });
        scrollThrough(40);
        expect(nextButton()).toBeNull();
      });
    }

    it("a rolagem suave para antes do alvo (scrollend): o estado desliga, sem temporizador", () => {
      answerLast();
      scrollThrough(250, 120);
      act(() => { scroller.dispatchEvent(new Event("scrollend")); });
      scrollThrough(40);
      expect(nextButton()).toBeNull();
    });

    it("um scrollend antes da rolagem suave andar (o da âncora) não desliga o estado", () => {
      answerLast();
      act(() => { scroller.dispatchEvent(new Event("scrollend")); });
      scrollThrough(100, 32);
      expect(nextButton()).toBeInTheDocument();
    });
  });
});
