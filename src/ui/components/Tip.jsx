import React, { useEffect, useId, useRef, useState } from "react";

// fincla-frontend#105 — evento global mínimo pra garantir UM tooltip aberto
// por vez sem precisar de Context: cada `Tip` aberto ouve o `show()` de
// qualquer OUTRO e fecha a si mesmo.
const TIP_OPEN_EVENT = "fincla:tip-open";

// Exportado só pra teste unitário isolado (fincla-frontend#105) — o
// comportamento de fechar não depende de nada da página, e testar via
// `<TransacoesPage>` inteira exigiria montar uma transação com refund/parcela
// só pra alcançar um `<Tip>`.
/* `style` existe porque o `<span>` do Tip vira ITEM DE FLEX no lugar de quem
   ele envolve: um botão com `flex:1` embrulhado aqui passa a flexionar dentro
   de um span que não cresce, e o layout do pai se desfaz em silêncio. Quem
   envolve precisa poder devolver as propriedades de flex ao invólucro. */
export const Tip = ({ label, children, pos = "top", style }) => {
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const id = useId();

  const show = (e) => {
    if (!ref.current) return;
    setRect(ref.current.getBoundingClientRect());
    window.dispatchEvent(new CustomEvent(TIP_OPEN_EVENT, { detail: { id } }));
  };
  const hide = () => setRect(null);

  // fincla-frontend#109 rodada 2, achado 5: com o early return agora DEPOIS
  // dos hooks (achado 1, crítico), a instância sobrevive ao intervalo em que
  // `label` fica vazio — mas `rect` (medido enquanto o label ANTERIOR estava
  // visível) não era limpo nesse intervalo. Quando o label volta (ex.: linha
  // 390, `hasParcela ? … : isRefund ? … : ""` alternando por causa de uma
  // atualização in-place), o tooltip REAPARECIA sozinho na posição antiga,
  // sem nenhum toque/hover novo. `label` vazio precisa fechar o tooltip.
  useEffect(() => {
    if (!label) setRect(null);
  }, [label]);

  // Fecha em QUALQUER interação seguinte enquanto está aberto: toque/clique
  // fora do próprio gatilho — inclusive o que abre o bottom sheet de
  // Detalhes, que antes deixava o tooltip flutuando por cima dele (prints do
  // Owner) —, rolagem de qualquer região (captura no `window` pega o scroll
  // de containers `.fincla-scroll` aninhados, que não sobe por bubbling
  // comum), Escape, e a abertura de outro tooltip. O `pointerdown` só fecha
  // quando o alvo está FORA do próprio gatilho — de propósito: um 2º toque no
  // MESMO gatilho é o toggle local (`onTouchStart` abaixo) que decide, e como
  // o `pointerdown` do toque precede o `touchstart`, fechar por fora aqui
  // reabriria no mesmo gesto (o toggle local leria `rect` já nulo). jsdom não
  // tem layout nem toque de verdade, então os testes cobrem o COMPORTAMENTO
  // observável (o tooltip sai do DOM ao disparar cada evento), nunca
  // `getComputedStyle`.
  useEffect(() => {
    if (rect === null) return undefined;
    const onPointerDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      hide();
    };
    const onScroll = () => hide();
    const onKeyDown = (e) => {
      if (e.key === "Escape") hide();
    };
    const onOtherTipOpen = (e) => {
      if (e.detail?.id !== id) hide();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(TIP_OPEN_EVENT, onOtherTipOpen);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(TIP_OPEN_EVENT, onOtherTipOpen);
    };
  }, [rect, id]);

  // fincla-frontend#109 achado 1 (crítico): este early return morava ANTES
  // dos hooks acima. `TxRow` chaveia linhas por `tx.id`, então a MESMA
  // instância de `<Tip>` sobrevive a uma atualização in-place (ex.: marcar
  // como estorno no drawer troca `label` de "" pra um texto, ou
  // `setTransactionSettled` zera `parcela` e troca `hasParcela` de true pra
  // false) — o número de hooks chamados variava conforme `label` estar vazio
  // ou não, e o React derruba a árvore inteira ("Rendered more/fewer hooks
  // than during the previous render"), sem error boundary = tela branca.
  // TODOS os hooks (`useState`/`useRef`/`useId`/`useEffect`) agora rodam
  // incondicionalmente; só a SAÍDA (early return) depende de `label`.
  if (!label) return <>{children}</>;

  // Compute fixed position from measured rect
  const tipStyle = rect ? (pos === "top"
    ? { top: rect.top - 6, left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)" }
    : { top: rect.bottom + 6, left: rect.left + rect.width / 2,
        transform: "translateX(-50%)" }
  ) : null;

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center", ...style }}
      onMouseEnter={show} onMouseLeave={hide}
      /* FOCO também abre. Sem isto o rótulo é só para quem usa mouse ou toque —
         e quem navega por teclado é justamente quem mais precisa dele, porque
         chega no alvo sem ver o percurso. Em React `onFocus`/`onBlur` usam
         `focusin`/`focusout`, que sobem: focar o botão lá dentro acende o
         tooltip aqui. */
      onFocus={show} onBlur={hide}
      onTouchStart={e => { e.stopPropagation(); rect ? hide() : show(e); }}>
      {children}
      {rect && tipStyle && (
        <span role="tooltip" style={{
          position:"fixed",
          top: tipStyle.top, left: tipStyle.left,
          transform: tipStyle.transform,
          background:"#1A1A2E", color:"#fff",
          fontSize:11, fontWeight:600, borderRadius:7, padding:"5px 9px",
          whiteSpace:"nowrap", zIndex:90, pointerEvents:"none",
          boxShadow:"0 4px 14px rgba(0,0,0,0.28)", lineHeight:1.4,
        }}>
          {label}
        </span>
      )}
    </span>
  );
};
