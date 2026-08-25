// @vitest-environment jsdom
/**
 * Puxar ↓ do topo para recarregar (§29).
 *
 * O que estes testes guardam é sobretudo o que o gesto NÃO pode fazer. Um
 * pull-to-refresh que rouba a rolagem ou o swipe das ações é pior que não ter
 * nenhum: ele quebra dois gestos que a pessoa usa o tempo todo para servir um
 * que ela usa raramente.
 */
import React, { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { usePullToRefresh, LIMIAR_PX } from "../usePullToRefresh.js";

afterEach(cleanup);

function Harness({ onRefresh, busy = false, enabled = true, scrollTop = 0 }) {
  const ref = useRef(null);
  const p = usePullToRefresh({ scrollRef: ref, onRefresh, enabled, busy });
  return (
    <div ref={ref} data-testid="scroller" style={{ overflowY: "auto" }}>
      <span data-testid="puxada">{p.puxada}</span>
      <span data-testid="limiar">{String(p.passouDoLimiar)}</span>
      <span data-testid="aguardando">{String(p.aguardando)}</span>
      <span data-testid="scrolltop-fixture">{scrollTop}</span>
    </div>
  );
}

/** jsdom não tem TouchEvent com `touches` utilizável; um Event cru basta. */
function toque(el, tipo, { x = 100, y = 200 } = {}) {
  const ev = new Event(tipo, { bubbles: true, cancelable: true });
  ev.touches = tipo === "touchend" ? [] : [{ clientX: x, clientY: y }];
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

const puxada = () => Number(screen.getByTestId("puxada").textContent);

describe("usePullToRefresh", () => {
  it("puxar além do limiar recarrega ao soltar", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    toque(el, "touchmove", { y: 400 });
    // Resistência de 0,5: 200 px de dedo viram 100, limitados ao teto de 96.
    expect(puxada()).toBeGreaterThanOrEqual(LIMIAR_PX);
    expect(screen.getByTestId("limiar").textContent).toBe("true");
    toque(el, "touchend");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("puxar de menos NÃO recarrega, e a lista volta ao lugar", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    toque(el, "touchmove", { y: 250 });   // 50 px de dedo → 25 px de puxada
    expect(puxada()).toBeLessThan(LIMIAR_PX);
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
    expect(puxada()).toBe(0);
  });

  it("arrastar para CIMA é rolar — o gesto desiste", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 120 });
    toque(el, "touchmove", { y: 60 });
    expect(puxada()).toBe(0);
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("arrastar de LADO é o swipe das ações — o gesto desiste", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { x: 200, y: 200 });
    toque(el, "touchmove", { x: 120, y: 210 });
    toque(el, "touchmove", { x: 40, y: 214 });
    expect(puxada()).toBe(0);
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("com a lista JÁ ROLADA, puxar para baixo é rolar de volta", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    Object.defineProperty(el, "scrollTop", { configurable: true, value: 400 });
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 400 });
    expect(puxada()).toBe(0);
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("desligado, nenhum toque produz puxada", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} enabled={false} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 400 });
    toque(el, "touchend");
    expect(puxada()).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("com uma busca já em voo, puxar não dispara outra", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} busy />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 400 });
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("o movimento que puxa CANCELA o evento — senão a lista rola por baixo", () => {
    render(<Harness onRefresh={vi.fn()} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    const ev = toque(el, "touchmove", { y: 300 });
    /* `preventDefault` é o que impede o scroller de consumir o mesmo dedo — e
       é por isso que o listener precisa ser `passive: false`. */
    expect(ev.defaultPrevented).toBe(true);
  });
});
