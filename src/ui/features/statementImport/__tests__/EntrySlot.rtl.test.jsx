/** @vitest-environment jsdom */
// O lugar de um lançamento na lista (fincla-api#507): a troca cartão ↔ linha é animada (altura,
// opacidade, selo "Conferido"), mas o estado muda na hora e a limpeza não depende de evento de fim
// de animação. jsdom não tem `Element.animate`: aqui ele é simulado.
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ConferidoBadge, EntrySlot } from "../entryQueue.jsx";

function Slot({ open }) {
  return (
    <EntrySlot open={open}>
      {open ? <div data-testid="card">cartão aberto</div> : <div data-testid="row">linha <ConferidoBadge /></div>}
    </EntrySlot>
  );
}

const fakeAnimation = () => ({ onfinish: null, oncancel: null, finished: Promise.resolve() });

afterEach(() => {
  cleanup();
  delete Element.prototype.animate;
  vi.unstubAllGlobals();
});

describe("EntrySlot", () => {
  it("sem Element.animate (jsdom) troca o cartão pela linha na hora, sem quebrar", () => {
    const { rerender } = render(<Slot open />);
    rerender(<Slot open={false} />);
    expect(screen.getByTestId("row")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).toBeNull();
    expect(screen.getByTestId("entry-slot")).toHaveAttribute("data-open", "false");
  });

  it("anima a altura e o selo, com a cópia antiga por cima, e limpa no fim ou no cancelamento", () => {
    const animations = [];
    Element.prototype.animate = vi.fn(function animate(keyframes, options) {
      const a = fakeAnimation();
      animations.push({ el: this, keyframes, options, a });
      return a;
    });
    const { rerender } = render(<Slot open />);
    rerender(<Slot open={false} />);

    // O estado já mudou: a linha está lá antes de qualquer animação terminar.
    const slot = screen.getByTestId("entry-slot");
    expect(screen.getByTestId("row")).toBeInTheDocument();
    const height = animations.find((x) => x.el === slot && x.keyframes[0].height !== undefined);
    expect(height).toBeTruthy();
    expect(animations.some((x) => x.el.matches?.("[data-okb]"))).toBe(true);
    // A cópia do cartão antigo, inerte e escondida do leitor de tela, some com a animação.
    const ghost = slot.querySelector("[aria-hidden='true'][inert]");
    expect(ghost).toHaveTextContent("cartão aberto");
    expect(slot.style.overflow).toBe("hidden");

    height.a.oncancel();
    expect(slot.querySelector("[inert]")).toBeNull();
    expect(slot.style.overflow).toBe("");
  });

  it("com movimento reduzido não anima nada", () => {
    Element.prototype.animate = vi.fn(fakeAnimation);
    vi.stubGlobal("matchMedia", (query) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<Slot open />);
    rerender(<Slot open={false} />);
    expect(screen.getByTestId("row")).toBeInTheDocument();
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it("desmontar no meio da animação limpa tudo", () => {
    Element.prototype.animate = vi.fn(fakeAnimation);
    const { rerender, unmount, container } = render(<Slot open />);
    rerender(<Slot open={false} />);
    unmount();
    expect(container.innerHTML).toBe("");
  });
});
