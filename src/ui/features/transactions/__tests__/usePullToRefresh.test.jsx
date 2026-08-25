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
import { usePullToRefresh, LIMIAR_PX, TETO_PX } from "../usePullToRefresh.js";

afterEach(cleanup);

function Harness({ onRefresh, busy = false, enabled = true }) {
  const ref = useRef(null);
  const p = usePullToRefresh({ scrollRef: ref, onRefresh, enabled, busy });
  return (
    <div ref={ref} data-testid="scroller" style={{ overflowY: "auto" }}>
      {/* Espelha o consumidor real: o nó só existe fora do repouso, e a altura
          é escrita pelo hook direto no DOM — não por estado do React. */}
      {!p.inerte && <div ref={p.indicadorRef} data-testid="indicador" style={{ height: 0 }} />}
      <span data-testid="fase">{p.fase}</span>
      <span data-testid="limiar">{String(p.passouDoLimiar)}</span>
      <span data-testid="aguardando">{String(p.aguardando)}</span>
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

const fase = () => screen.getByTestId("fase").textContent;
const altura = () => {
  const el = screen.queryByTestId("indicador");
  return el ? parseFloat(el.style.height || "0") : 0;
};

describe("usePullToRefresh", () => {
  it("puxar além do limiar recarrega ao soltar", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    toque(el, "touchmove", { y: 400 });
    // Resistência de 0,5: 200 px de dedo viram 100, limitados ao teto de 96.
    expect(altura()).toBeGreaterThanOrEqual(LIMIAR_PX);
    expect(altura()).toBeLessThanOrEqual(TETO_PX);
    expect(fase()).toBe("solte");
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
    expect(altura()).toBeLessThan(LIMIAR_PX);
    expect(fase()).toBe("puxando");
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
    expect(altura()).toBe(0);
  });

  it("arrastar para CIMA é rolar — o gesto desiste", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 120 });
    toque(el, "touchmove", { y: 60 });
    expect(fase()).toBe("inerte");
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
    expect(fase()).toBe("inerte");
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
    expect(fase()).toBe("inerte");
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
    expect(fase()).toBe("inerte");
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


  /* O caminho que a suíte anterior não cobria — e por isso ficava verde com ele
     quebrado. `onRefresh` só PEDE a recarga; quem acende `busy` é o hook de
     dados, um commit depois. Recolher em "aguardando + !busy" desmontava o
     indicador no quadro seguinte ao touchend, e `aguardando` nunca chegava a
     ser verdade uma única vez. */
  it("o indicador FICA na passagem de mão até a busca acender", async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<Harness onRefresh={onRefresh} busy={false} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    toque(el, "touchmove", { y: 400 });
    toque(el, "touchend");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // Ainda não acendeu: o indicador não pode ter sumido.
    expect(fase()).toBe("aguardando");
    expect(altura()).toBeGreaterThan(0);

    // Acende…
    rerender(<Harness onRefresh={onRefresh} busy />);
    expect(fase()).toBe("aguardando");
    expect(screen.getByTestId("aguardando").textContent).toBe("true");

    // …e só quando apaga é que ele recolhe.
    rerender(<Harness onRefresh={onRefresh} busy={false} />);
    expect(altura()).toBe(0);
  });

  it("voltar o dedo ACIMA da origem não produz altura negativa", () => {
    render(<Harness onRefresh={vi.fn()} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 240 });   // compromete o gesto
    toque(el, "touchmove", { y: 100 });   // e volta bem acima
    /* `height: -50px` é valor inválido: o navegador o descarta e a caixa volta
       para `auto`, deixando o rótulo à mostra em vez de encolhida. */
    expect(altura()).toBe(0);
  });

  it("touchcancel NÃO recarrega — o sistema tomou o gesto, a pessoa não soltou", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 220 });
    toque(el, "touchmove", { y: 400 });
    expect(fase()).toBe("solte");
    toque(el, "touchcancel");
    expect(onRefresh).not.toHaveBeenCalled();
    expect(altura()).toBe(0);
  });

  it("um segundo dedo CANCELA — não deixa a recarga escapar no meio", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId("scroller");
    toque(el, "touchstart", { y: 200 });
    toque(el, "touchmove", { y: 400 });
    /* O segundo dedo chega; o `touchend` DELE não pode executar a recarga com o
       primeiro ainda na tela. */
    const ev = new Event("touchstart", { bubbles: true, cancelable: true });
    ev.touches = [{ clientX: 100, clientY: 400 }, { clientX: 150, clientY: 300 }];
    act(() => { el.dispatchEvent(ev); });
    toque(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("o gesto não re-renderiza a página a cada movimento", () => {
    const renders = { n: 0 };
    function Contador(props) { renders.n += 1; return <Harness {...props} />; }
    render(<Contador onRefresh={vi.fn()} />);
    const el = screen.getByTestId("scroller");
    const antes = renders.n;
    toque(el, "touchstart", { y: 200 });
    for (let y = 210; y <= 260; y += 5) toque(el, "touchmove", { y });
    /* Onze movimentos, UMA mudança de fase ("inerte" → "puxando"). A altura vai
       direto no DOM: nada aqui é `memo` e as linhas não são virtualizadas, então
       um `setState` por movimento seria a lista inteira re-renderizando na
       cadência do dedo, num celular. */
    expect(renders.n - antes).toBeLessThanOrEqual(2);
    expect(altura()).toBeGreaterThan(0);
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
