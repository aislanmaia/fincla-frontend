// @vitest-environment jsdom
/**
 * O voo é reforço, nunca requisito.
 *
 * Estes testes guardam as três formas de ele NÃO acontecer sem levar nada
 * junto: sem elementos, com `prefers-reduced-motion`, e a limpeza do clone.
 * Um clone preso sobre a tela é pior que animação nenhuma — ele fica ali
 * cobrindo a interface para sempre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flyToChip } from "../flyToChip.js";

function elementoEm(x, y, w = 60, h = 20) {
  const el = document.createElement("span");
  el.textContent = "19 a pagar";
  el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h });
  document.body.appendChild(el);
  return el;
}

const clones = () =>
  document.querySelectorAll('body > [aria-hidden="true"]').length;

beforeEach(() => {
  document.body.innerHTML = "";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});
afterEach(() => vi.useRealTimers());

describe("flyToChip", () => {
  it("não faz nada sem origem ou destino", () => {
    expect(() => flyToChip(null, elementoEm(0, 0))).not.toThrow();
    expect(() => flyToChip(elementoEm(0, 0), null)).not.toThrow();
    expect(clones()).toBe(0);
  });

  it("respeita prefers-reduced-motion", () => {
    // Quem pediu menos movimento não recebe nenhum — e o filtro é aplicado do
    // mesmo jeito, porque quem aplica é o clique, não a animação.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    flyToChip(elementoEm(10, 10), elementoEm(400, 40));
    expect(clones()).toBe(0);
  });

  it("não anima elementos sem caixa — o clone ficaria preso na tela", () => {
    const semCaixa = document.createElement("span");
    semCaixa.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    document.body.appendChild(semCaixa);
    flyToChip(semCaixa, elementoEm(400, 40));
    expect(clones()).toBe(0);
  });

  it("clona, marca como decorativo e limpa sozinho", () => {
    vi.useFakeTimers();
    const origem = elementoEm(10, 10);
    const destino = elementoEm(400, 40);
    flyToChip(origem, destino, { duracao: 100 });

    const clone = document.querySelector('body > [aria-hidden="true"][style*="fixed"]');
    expect(clone).not.toBeNull();
    // Decorativo para leitor de tela, e invisível ao cursor: sem isto ele
    // intercepta o clique seguinte no meio do caminho.
    expect(clone.style.pointerEvents).toBe("none");
    // O ORIGINAL não se move: mover o de verdade tira-o do fluxo e a linha salta.
    expect(origem.style.position).toBe("");

    // A rede de segurança: mesmo sem `transitionend` (aba em segundo plano), o
    // clone tem de sair.
    vi.advanceTimersByTime(300);
    expect(document.querySelector('body > [aria-hidden="true"][style*="fixed"]')).toBeNull();
  });
});
