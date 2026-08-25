import { useCallback, useEffect, useRef, useState } from "react";

/** Onde a puxada vira recarga. Curto demais dispara sem querer ao rolar. */
export const LIMIAR_PX = 64;
/** Teto do arrasto: além disso a mão só cansa, o gesto já foi entendido. */
const TETO_PX = 96;
/** Quanto do dedo vira deslocamento. Abaixo de 1 a lista "pesa" e resiste. */
const RESISTENCIA = 0.5;
/** Onde o indicador descansa enquanto a busca corre. */
const REPOUSO_PX = 48;

/**
 * Puxar para baixo, a partir do topo, para recarregar.
 *
 * O gesto tem de ser NOSSO: o app desliga o pull-to-refresh nativo de propósito
 * (`overscroll-behavior: none` no shell), para o gesto não arrancar a tela
 * inteira quando alguém rola por cima de uma lista.
 *
 * Só o topo, e só para baixo. Puxar para CIMA no fim da lista era a outra
 * leitura possível, e ela colide com o scroll infinito: chegar ao fim já
 * carrega mais páginas, então o mesmo gesto teria dois significados dependendo
 * de haver ou não página seguinte — a pior ambiguidade, a que muda sozinha.
 *
 * @param {object}   p
 * @param {{current: HTMLElement|null}} p.scrollRef  A região que rola.
 * @param {() => void} p.onRefresh                   O que fazer ao soltar além do limiar.
 * @param {boolean}  p.enabled                       Só no toque, e só com a lista pronta.
 * @param {boolean}  p.busy                          Uma busca já está em voo.
 */
export function usePullToRefresh({ scrollRef, onRefresh, enabled = true, busy = false }) {
  const [puxada, setPuxadaState] = useState(0);
  /* O ref espelha o estado porque `soltar` precisa LER a puxada no mesmo tick
     em que decide. Ler dentro do updater de `setPuxada` parecia mais curto e
     estava errado: um updater tem de ser puro, e disparar a recarga lá dentro
     fazia o React executá-lo de novo (StrictMode) ou descartá-lo — o rótulo
     dizia "Solte para recarregar", a pessoa soltava, e nada acontecia. */
  const puxadaRef = useRef(0);
  const setPuxada = useCallback((v) => { puxadaRef.current = v; setPuxadaState(v); }, []);
  const [armado, setArmado] = useState(false);
  const estadoRef = useRef({ ativo: false, y0: 0, x0: 0, decidiu: false });
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  /* Enquanto a busca corre o indicador FICA, em repouso. Sumir no instante em
     que se solta o dedo devolveria a lista ao estado de antes e faria o gesto
     parecer ignorado — justamente o que ele existe para evitar. */
  useEffect(() => {
    if (!armado) return undefined;
    if (busy) { setPuxada(REPOUSO_PX); return undefined; }
    setPuxada(0);
    setArmado(false);
    return undefined;
  }, [armado, busy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return undefined;

    const inicio = (e) => {
      if (busyRef.current || e.touches.length !== 1) return;
      // O gesto só nasce no TOPO: no meio da lista, puxar para baixo é rolar.
      if (el.scrollTop > 0) return;
      const t = e.touches[0];
      estadoRef.current = { ativo: true, y0: t.clientY, x0: t.clientX, decidiu: false };
    };

    const mover = (e) => {
      const st = estadoRef.current;
      if (!st.ativo || busyRef.current) return;
      const t = e.touches[0];
      const dy = t.clientY - st.y0;
      const dx = t.clientX - st.x0;

      /* A PRIMEIRA direção decide, e decide uma vez só. Sem esta trava, um
         gesto que começa para baixo e desvia vira uma disputa entre a puxada e
         a rolagem, e a lista treme. E se a intenção era rolar para cima ou
         arrastar de lado (o swipe das ações vive aqui), a puxada desiste. */
      if (!st.decidiu) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { st.ativo = false; return; }
        st.decidiu = true;
      }
      if (el.scrollTop > 0) { st.ativo = false; setPuxada(0); return; }

      /* `preventDefault` é o que impede o scroller de consumir o mesmo dedo —
         e é por isso que este listener PRECISA ser `passive: false`. Com
         listener passivo o navegador ignora a chamada e a lista rola por baixo
         do indicador. */
      e.preventDefault();
      setPuxada(Math.min(TETO_PX, dy * RESISTENCIA));
    };

    const soltar = () => {
      const st = estadoRef.current;
      const distancia = puxadaRef.current;
      estadoRef.current = { ativo: false, y0: 0, x0: 0, decidiu: false };
      if (!st.ativo || !st.decidiu) { setPuxada(0); return; }
      if (distancia >= LIMIAR_PX && !busyRef.current) {
        setArmado(true);
        setPuxada(REPOUSO_PX);
        onRefreshRef.current?.();
        return;
      }
      setPuxada(0);
    };

    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", soltar, { passive: true });
    el.addEventListener("touchcancel", soltar, { passive: true });
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", soltar);
      el.removeEventListener("touchcancel", soltar);
    };
  }, [scrollRef, enabled]);

  const passouDoLimiar = puxada >= LIMIAR_PX;
  return {
    /** Deslocamento atual, em px. */
    puxada,
    /** A puxada já basta: soltar agora recarrega. */
    passouDoLimiar,
    /** Está segurando o indicador porque a busca corre. */
    aguardando: armado && busy,
    /** Nada acontecendo — para o consumidor não pagar render à toa. */
    inerte: puxada === 0 && !armado,
  };
}
