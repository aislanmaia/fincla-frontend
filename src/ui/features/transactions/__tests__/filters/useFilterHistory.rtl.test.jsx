// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFilterHistory } from "../../filters/useFilterHistory.js";

afterEach(cleanup);

const describeSnap = (s) => `tipo=${s.type}`;

function setup(initial = { type: "todos", cats: [] }) {
  const applied = [];
  const applySnapshot = vi.fn((s) => applied.push(s));
  const hook = renderHook(({ snapshot }) => useFilterHistory(snapshot, applySnapshot, describeSnap), {
    initialProps: { snapshot: initial },
  });
  return { ...hook, applySnapshot, applied };
}

describe("useFilterHistory", () => {
  it("começa sem nada para desfazer", () => {
    const { result } = setup();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.undoLabel).toBe("");
  });

  it("empilha o estado ANTERIOR a cada mudança de filtro", () => {
    const { result, rerender } = setup();
    rerender({ snapshot: { type: "despesa", cats: [] } });

    expect(result.current.canUndo).toBe(true);
    // O rótulo descreve para onde VOLTA, não onde está.
    expect(result.current.undoLabel).toBe("tipo=todos");
  });

  it("desfazer aplica o snapshot anterior e consome o passo", () => {
    const { result, rerender, applied } = setup();
    rerender({ snapshot: { type: "despesa", cats: [] } });

    act(() => result.current.undo());

    expect(applied).toEqual([{ type: "todos", cats: [] }]);
    expect(result.current.canUndo).toBe(false);
  });

  it("a restauração NÃO se auto-empilha", () => {
    // Sem o flag, desfazer viraria mais um passo do histórico e o botão nunca
    // esvaziaria — voltar e voltar de novo ficaria em loop entre dois estados.
    const { result, rerender } = setup();
    rerender({ snapshot: { type: "despesa", cats: [] } });
    act(() => result.current.undo());
    rerender({ snapshot: { type: "todos", cats: [] } });

    expect(result.current.canUndo).toBe(false);
  });

  it("um objeto novo com o MESMO conteúdo não conta como passo", () => {
    // O hook de filtros devolve um snapshot novo a cada render; comparar por
    // referência empilharia um passo por quadro.
    const { result, rerender } = setup();
    rerender({ snapshot: { type: "todos", cats: [] } });
    expect(result.current.canUndo).toBe(false);
  });

  it("desfaz vários passos, na ordem inversa", () => {
    const { result, rerender, applied } = setup();
    rerender({ snapshot: { type: "despesa", cats: [] } });
    rerender({ snapshot: { type: "despesa", cats: ["a"] } });
    rerender({ snapshot: { type: "receita", cats: ["a"] } });

    act(() => result.current.undo());
    expect(applied.at(-1)).toEqual({ type: "despesa", cats: ["a"] });
    rerender({ snapshot: { type: "despesa", cats: ["a"] } });

    act(() => result.current.undo());
    expect(applied.at(-1)).toEqual({ type: "despesa", cats: [] });
  });

  it("guarda no máximo 12 passos", () => {
    const { result, rerender } = setup({ type: "t0", cats: [] });
    for (let i = 1; i <= 20; i += 1) rerender({ snapshot: { type: `t${i}`, cats: [] } });

    // O topo é o penúltimo estado; o fundo caiu fora — além de 12 passos vira
    // arqueologia, não desfazer.
    expect(result.current.undoLabel).toBe("tipo=t19");
    act(() => {
      for (let i = 0; i < 12; i += 1) result.current.undo();
    });
    expect(result.current.canUndo).toBe(false);
  });

  it("desfazer com a pilha vazia não faz nada", () => {
    const { result, applySnapshot } = setup();
    act(() => result.current.undo());
    expect(applySnapshot).not.toHaveBeenCalled();
  });
});
