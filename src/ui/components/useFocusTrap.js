import { useEffect } from "react";

/**
 * Prende o foco dentro de um contêiner enquanto ele estiver aberto, e devolve
 * ao gatilho ao fechar.
 *
 * Por que isto importa aqui: o sheet de filtros cobre a tela com um backdrop,
 * mas o botão que o abriu continua no fluxo de Tab por trás dele. Quem navega
 * por teclado tabula para fora do sheet, alcança controles que não consegue
 * ver e age neles às cegas — e ao fechar, o Tab recomeça do topo do documento.
 *
 * Devolver o foco ao gatilho é a metade que costuma faltar: sem ela, fechar um
 * painel custa uma travessia inteira do documento para voltar de onde se
 * estava.
 */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
  ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(containerRef, ativo) {
  useEffect(() => {
    if (!ativo) return undefined;
    const gatilho = document.activeElement;

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const raiz = containerRef.current;
      if (!raiz) return;
      const itens = Array.from(raiz.querySelectorAll(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (itens.length === 0) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      /* O ciclo é fechado nas DUAS pontas: só prender o fim deixa Shift+Tab
         escapar por cima, que é o caminho mais comum de sair sem querer. */
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      } else if (!raiz.contains(document.activeElement)) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      /* Só devolve se o gatilho ainda existe e ainda é focável: depois de
         excluir uma transação, por exemplo, ele pode ter saído do DOM. */
      if (gatilho && document.contains(gatilho) && typeof gatilho.focus === "function") {
        gatilho.focus();
      }
    };
  }, [containerRef, ativo]);
}
