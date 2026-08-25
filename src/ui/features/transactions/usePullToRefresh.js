import { useCallback, useEffect, useRef, useState } from "react";

/** Onde a puxada vira recarga. Curto demais dispara sem querer ao rolar. */
export const LIMIAR_PX = 64;
/** Teto do arrasto: além disso a mão só cansa, o gesto já foi entendido. */
export const TETO_PX = 96;
/** Quanto do dedo vira deslocamento. Abaixo de 1 a lista "pesa" e resiste. */
const RESISTENCIA = 0.5;
/** Onde o indicador descansa enquanto a busca corre. */
const REPOUSO_PX = 48;
/** Duração do recolhimento — o mesmo `--mo-base` do resto da tela. */
const VOLTA_MS = 220;
/** Se a busca não acender em 1,5 s, algo deu errado: recolhe assim mesmo. */
const ESPERA_MAX_MS = 1500;

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
 * A ALTURA é escrita direto no DOM, não em estado do React. Um `setState` por
 * `touchmove` re-renderizava a página inteira — e nada aqui é `memo`, nem as
 * linhas são virtualizadas, então depois de algumas páginas de scroll infinito
 * isso é a lista toda re-renderizando na cadência do dedo, num celular. O
 * estado guarda só as FASES, que mudam meia dúzia de vezes por gesto.
 *
 * @param {object}   p
 * @param {{current: HTMLElement|null}} p.scrollRef  A região que rola.
 * @param {() => void} p.onRefresh                   O que fazer ao soltar além do limiar.
 * @param {boolean}  p.enabled                       Só no toque, e só com a lista pronta.
 * @param {boolean}  p.busy                          Uma busca já está em voo.
 */
export function usePullToRefresh({ scrollRef, onRefresh, enabled = true, busy = false }) {
  /** "inerte" | "puxando" | "solte" | "aguardando" */
  const [fase, setFaseState] = useState("inerte");
  const faseRef = useRef("inerte");
  const setFase = useCallback((f) => {
    if (faseRef.current === f) return;
    faseRef.current = f;
    setFaseState(f);
  }, []);

  const indicadorRef = useRef(null);
  const puxadaRef = useRef(0);
  const estadoRef = useRef({ ativo: false, y0: 0, x0: 0, decidiu: false });
  const timersRef = useRef({ volta: null, espera: null });
  const viuBuscaRef = useRef(false);

  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  /** Escreve a altura direto no nó — sem passar pelo React. */
  const pintar = useCallback((px, comTransicao) => {
    puxadaRef.current = px;
    const el = indicadorRef.current;
    if (!el) return;
    el.style.transition = comTransicao
      ? `height ${VOLTA_MS}ms var(--mo-base-ease, cubic-bezier(.32,.72,0,1))`
      : "none";
    el.style.height = `${px}px`;
  }, []);

  /** Volta ao repouso e desmonta depois da animação — não durante. */
  const recolher = useCallback(() => {
    clearTimeout(timersRef.current.espera);
    viuBuscaRef.current = false;
    pintar(0, true);
    clearTimeout(timersRef.current.volta);
    timersRef.current.volta = setTimeout(() => setFase("inerte"), VOLTA_MS);
  }, [pintar, setFase]);

  /* O indicador FICA enquanto a busca corre. Sumir no instante em que se solta
     o dedo devolveria a lista ao estado de antes e faria o gesto parecer
     ignorado — justamente o que ele existe para evitar.

     E é preciso esperar o flanco de SUBIDA: `onRefresh` só pede a recarga, e
     quem acende `busy` é o efeito do hook de dados, um commit depois. Recolher
     em "aguardando + !busy" desmontava o indicador no quadro seguinte ao
     touchend, e o `aguardando` nunca chegava a ser verdade uma única vez. */
  useEffect(() => {
    if (fase !== "aguardando") return undefined;
    if (busy) { viuBuscaRef.current = true; return undefined; }
    if (viuBuscaRef.current) { recolher(); return undefined; }
    // A busca pode nem acender (dados em cache, modo mock, falha síncrona).
    clearTimeout(timersRef.current.espera);
    timersRef.current.espera = setTimeout(recolher, ESPERA_MAX_MS);
    return undefined;
  }, [fase, busy, recolher]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return undefined;

    const cancelarGesto = () => { estadoRef.current = { ativo: false, y0: 0, x0: 0, decidiu: false }; };

    const inicio = (e) => {
      /* Um segundo dedo CANCELA o gesto em vez de ser ignorado. Só retornar
         cedo deixava o gesto `ativo`, e o `touchend` do segundo dedo executava
         a recarga com o primeiro ainda na tela — no meio da puxada. */
      if (e.touches.length !== 1) { cancelarGesto(); return; }
      if (busyRef.current || faseRef.current === "aguardando") return;
      // O gesto só nasce no TOPO: no meio da lista, puxar para baixo é rolar.
      if (el.scrollTop > 0) return;
      const t = e.touches[0];
      estadoRef.current = { ativo: true, y0: t.clientY, x0: t.clientX, decidiu: false };
    };

    const mover = (e) => {
      const st = estadoRef.current;
      if (!st.ativo || busyRef.current) return;
      if (e.touches.length !== 1) { cancelarGesto(); pintar(0, true); setFase("inerte"); return; }
      const t = e.touches[0];
      const dy = t.clientY - st.y0;
      const dx = t.clientX - st.x0;

      /* A PRIMEIRA direção decide, e decide uma vez só. Sem esta trava, um
         gesto que começa para baixo e desvia vira uma disputa entre a puxada e
         a rolagem, e a lista treme. E se a intenção era rolar para cima ou
         arrastar de lado (o swipe das ações vive aqui), a puxada desiste. */
      if (!st.decidiu) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { cancelarGesto(); return; }
        st.decidiu = true;
        setFase("puxando");
      }
      if (el.scrollTop > 0) { cancelarGesto(); pintar(0, false); setFase("inerte"); return; }

      /* `preventDefault` é o que impede o scroller de consumir o mesmo dedo —
         e é por isso que este listener PRECISA ser `passive: false`. Com
         listener passivo o navegador ignora a chamada e a lista rola por baixo
         do indicador. */
      e.preventDefault();
      /* `Math.max(0, …)`: depois de decidido, o dedo pode voltar ACIMA da
         origem, e um `dy` negativo virava `height: -50px` — valor inválido, que
         o navegador descarta, deixando a caixa em `auto` com o rótulo à mostra
         em vez de encolhida. */
      const px = Math.max(0, Math.min(TETO_PX, dy * RESISTENCIA));
      pintar(px, false);
      setFase(px >= LIMIAR_PX ? "solte" : "puxando");
    };

    const soltar = () => {
      const st = estadoRef.current;
      const distancia = puxadaRef.current;
      cancelarGesto();
      if (!st.ativo || !st.decidiu) { pintar(0, true); setFase("inerte"); return; }
      if (distancia >= LIMIAR_PX && !busyRef.current) {
        viuBuscaRef.current = false;
        pintar(REPOUSO_PX, true);
        setFase("aguardando");
        onRefreshRef.current?.();
        return;
      }
      pintar(0, true);
      clearTimeout(timersRef.current.volta);
      timersRef.current.volta = setTimeout(() => setFase("inerte"), VOLTA_MS);
    };

    /* `touchcancel` NÃO recarrega. Ele é o sistema tomando o gesto de volta —
       swipe de borda do iOS, uma chamada entrando, o navegador assumindo o
       arrasto. Tratá-lo como `touchend` disparava uma recarga por um gesto que
       a pessoa nunca completou. */
    const cancelar = () => {
      cancelarGesto();
      pintar(0, true);
      clearTimeout(timersRef.current.volta);
      timersRef.current.volta = setTimeout(() => setFase("inerte"), VOLTA_MS);
    };

    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", soltar, { passive: true });
    el.addEventListener("touchcancel", cancelar, { passive: true });
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", soltar);
      el.removeEventListener("touchcancel", cancelar);
      /* Zera ao desligar. `enabled` vem da largura, então girar o aparelho no
         meio da puxada tirava os listeners e deixava a altura congelada, sem
         ninguém para limpá-la. */
      cancelarGesto();
      puxadaRef.current = 0;
      if (indicadorRef.current) indicadorRef.current.style.height = "0px";
      faseRef.current = "inerte";
      setFaseState("inerte");
    };
  }, [scrollRef, enabled, pintar, setFase]);

  useEffect(() => () => {
    clearTimeout(timersRef.current.volta);
    clearTimeout(timersRef.current.espera);
  }, []);

  return {
    /** Onde o consumidor pendura o nó cuja altura este hook controla. */
    indicadorRef,
    fase,
    /** A puxada já basta: soltar agora recarrega. */
    passouDoLimiar: fase === "solte",
    /** Segurando o indicador porque a busca corre. */
    aguardando: fase === "aguardando",
    /** Nada acontecendo — o consumidor nem monta o indicador. */
    inerte: fase === "inerte",
  };
}
