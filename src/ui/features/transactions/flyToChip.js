/**
 * O voo da label "N a pagar" até a barra de comando.
 *
 * Por que existe: clicar em "19 a pagar" aplica o filtro e a label DESAPARECE.
 * Não é bug de renderização — com "Situação: a pagar" ativo, toda linha visível
 * é a pagar e o contador de pendentes vira zero por definição. A informação
 * deixou de fazer sentido onde estava.
 *
 * Mas sumir sem transição desorienta: a pessoa clica e o que ela clicou some.
 * A ligação existe (o filtro VEIO dali) e a tela não a mostrava. O voo diz que
 * é o MESMO objeto mudando de lugar, em vez de um evaporar e outro nascer noutro
 * canto.
 *
 * É um clone descartável, e não o elemento real: mover o original tira-o do
 * fluxo no meio da animação e a linha inteira salta.
 */
export function flyToChip(origem, destino, { duracao = 420 } = {}) {
  if (typeof document === "undefined" || !origem || !destino) return;
  /* Quem pediu menos movimento não recebe nenhum: a animação é reforço, e o
     filtro já foi aplicado de qualquer forma. */
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const de = origem.getBoundingClientRect();
  const para = destino.getBoundingClientRect();
  if (de.width === 0 || para.width === 0) return;

  const clone = origem.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  // Sem `pointer-events`, o clone intercepta o cursor no caminho e pode roubar
  // o clique seguinte no meio do voo.
  Object.assign(clone.style, {
    position: "fixed",
    left: `${de.left}px`,
    top: `${de.top}px`,
    width: `${de.width}px`,
    height: `${de.height}px`,
    margin: "0",
    zIndex: "800",
    pointerEvents: "none",
    transition: `transform ${duracao}ms cubic-bezier(.4,0,.2,1), opacity ${duracao}ms ease`,
  });
  document.body.appendChild(clone);

  const dx = para.left + para.width / 2 - (de.left + de.width / 2);
  const dy = para.top + para.height / 2 - (de.top + de.height / 2);

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.86)`;
    clone.style.opacity = "0.15";
  });

  const limpar = () => clone.remove();
  clone.addEventListener("transitionend", limpar, { once: true });
  // Rede: se a transição não disparar (aba em segundo plano, motion desligado
  // no meio do caminho), o clone não pode ficar preso sobre a tela.
  setTimeout(limpar, duracao + 120);
}
