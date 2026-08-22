import { useCallback, useEffect, useRef, useState } from "react";

/** Quantos passos atrás guardamos. Além disso vira arqueologia, não desfazer. */
const MAX_DEPTH = 12;

/**
 * Desfazer para os filtros.
 *
 * Filtrar rápido só é seguro se voltar for igualmente rápido. Com o clique na
 * categoria da própria linha (um gesto de UM toque, fácil de disparar sem
 * querer), sem desfazer o usuário teria que reconstruir à mão o recorte em que
 * estava — e a tela puniria justamente a exploração que ela quer incentivar.
 *
 * Guarda os snapshots ANTERIORES, não o atual: `undo()` aplica o topo da pilha.
 * A restauração é marcada com um flag para não se auto-empilhar — sem isso,
 * desfazer viraria mais um passo do histórico e o botão nunca esvaziaria.
 *
 * @param {object} snapshot - o snapshot atual (de `useTransactionsFilterState`)
 * @param {(s: object) => void} applySnapshot
 * @param {(s: object) => string} describe - rótulo do que voltar significa
 */
export function useFilterHistory(snapshot, applySnapshot, describe) {
  const [stack, setStack] = useState([]);
  const previous = useRef(snapshot);
  const restoring = useRef(false);

  useEffect(() => {
    const before = previous.current;
    previous.current = snapshot;
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    // Comparação por conteúdo: o hook de filtros devolve um objeto novo a cada
    // render, então comparar por referência empilharia um passo por quadro e o
    // desfazer não sairia do lugar.
    if (JSON.stringify(before) === JSON.stringify(snapshot)) return;
    setStack((prev) => [before, ...prev].slice(0, MAX_DEPTH));
  }, [snapshot]);

  const undo = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      restoring.current = true;
      applySnapshot(prev[0]);
      return prev.slice(1);
    });
  }, [applySnapshot]);

  const reset = useCallback(() => setStack([]), []);

  return {
    canUndo: stack.length > 0,
    undo,
    reset,
    /** O que o botão vai devolver — vira o `title`/`aria-label` do controle. */
    undoLabel: stack.length > 0 && typeof describe === "function" ? describe(stack[0]) : "",
  };
}
