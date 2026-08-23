import { useCallback, useRef, useState } from "react";

/** Quanto a linha desliza para revelar as ações. Casa com a largura do painel. */
export const SWIPE_WIDTH = 124;

/**
 * Arrastar a linha para o lado revela pagar/excluir — o gesto do mobile.
 *
 * A regra que faz ou quebra isto: **só assume o gesto quando ele é claramente
 * horizontal**. A lista rola verticalmente por baixo, e um handler que captura
 * qualquer toque mata a rolagem — foi exatamente esse tipo de captura que
 * deixou a lista impossível de rolar pelos itens. Por isso há um limiar
 * (`SLOP`) e uma comparação dx × dy antes de decidir de quem é o gesto; até lá
 * nada é bloqueado.
 *
 * Uma linha aberta por vez: duas abertas deixariam a tela com dois conjuntos de
 * ações e nenhuma pista de qual pertence a quê.
 */
const SLOP = 10;

export function useSwipeActions() {
  const [openId, setOpenId] = useState(null);
  const start = useRef(null);
  const axis = useRef(null);

  const close = useCallback(() => setOpenId(null), []);

  const handlers = useCallback(
    (id) => ({
      onTouchStart: (e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
        axis.current = null;
      },
      onTouchMove: (e) => {
        if (!start.current) return;
        const t = e.touches[0];
        const dx = t.clientX - start.current.x;
        const dy = t.clientY - start.current.y;
        if (axis.current === null) {
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          // Vertical vence empate: rolar é o gesto comum, revelar ações é o raro.
          axis.current = Math.abs(dx) > Math.abs(dy) * 1.4 ? "x" : "y";
        }
        if (axis.current !== "x") return;
        // Só a partir daqui o gesto é nosso — antes disso o navegador precisa
        // continuar livre para rolar.
        if (e.cancelable) e.preventDefault();
        if (dx < -SLOP) setOpenId(id);
        else if (dx > SLOP) setOpenId((cur) => (cur === id ? null : cur));
      },
      onTouchEnd: () => {
        start.current = null;
        axis.current = null;
      },
    }),
    [],
  );

  return { openId, handlers, close, isOpen: (id) => openId === id };
}
