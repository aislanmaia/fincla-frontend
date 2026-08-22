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
  // Pilha do refazer. Um filtro NOVO a limpa: refazer para um estado que já não
  // é o futuro daquele caminho devolveria um recorte que a pessoa não pediu.
  const [redoStack, setRedoStack] = useState([]);
  const previous = useRef(snapshot);
  const restoring = useRef(false);
  // Espelho do topo da pilha para `undo()` ler SEM entrar no updater. Um
  // updater de `useState` tem que ser puro: o React o invoca duas vezes em
  // StrictMode, e chamar `applySnapshot` lá dentro dispararia a restauração
  // em duplicidade.
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const redoRef = useRef(redoStack);
  redoRef.current = redoStack;

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
    setRedoStack([]);
  }, [snapshot]);

  const undo = useCallback(() => {
    const top = stackRef.current[0];
    if (top === undefined) return;
    restoring.current = true;
    const current = previous.current;
    setStack((prev) => prev.slice(1));
    setRedoStack((prev) => [current, ...prev].slice(0, MAX_DEPTH));
    applySnapshot(top);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const top = redoRef.current[0];
    if (top === undefined) return;
    restoring.current = true;
    const current = previous.current;
    setRedoStack((prev) => prev.slice(1));
    setStack((prev) => [current, ...prev].slice(0, MAX_DEPTH));
    applySnapshot(top);
  }, [applySnapshot]);

  const reset = useCallback(() => {
    setStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: stack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,
    reset,
    /** O que o botão vai devolver — vira o `title`/`aria-label` do controle. */
    undoLabel: stack.length > 0 && typeof describe === "function" ? describe(stack[0]) : "",
    redoLabel: redoStack.length > 0 && typeof describe === "function" ? describe(redoStack[0]) : "",
  };
}
