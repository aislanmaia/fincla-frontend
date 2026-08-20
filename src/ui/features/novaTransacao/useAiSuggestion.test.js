// @vitest-environment jsdom
//
// fincla-frontend#109 — três rodadas de revisão sobre este hook:
//
// Rodada 1 (achado 4): `ensureDetailTag` pode rejeitar de propósito (catálogo
// de tags ainda carregando — fail-closed do fincla-frontend#101), e a
// sugestão de IA é heurística LOCAL e SÍNCRONA: nada impede o clique em
// "Aplicar" antes do catálogo terminar de carregar.
//
// Rodada 2 (achado 2): a 1ª correção fazia a tag que falhasse cair em
// `setTags` (texto livre) — estado MORTO em modo live (nem renderizado nem
// enviado). Corrigido pra não fechar `aiApplied(true)` quando alguma tag
// falha.
//
// Rodada 3 (achados 1 e 3):
//  - achado 1: `setDetailTagIds(nextIds)` SUBSTITUÍA a lista inteira — se a
//    pessoa já tinha escolhido tags de detalhe à mão (quick-add, chips
//    sugeridos) antes de clicar "Aplicar", elas desapareciam. Regra dura do
//    projeto: nenhuma ação de IA pode destruir o que a pessoa já tem na
//    tela. Por isso este teste usa `useState` DE VERDADE pro harness (não só
//    `vi.fn()`) — só assim dá pra provar que o merge preserva o que já
//    estava lá, e não só "o que a última chamada mandou".
//  - achado 3: o `catch` engolia a mensagem — clicar "Aplicar" e a tag
//    falhar não dava NENHUMA explicação. Mesmo padrão do caminho irmão
//    `addQuickDetailTag` (NovaTransacaoModal.jsx): expõe `err.message` via
//    `setTxSubmitError`.
import { useRef, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiSuggestion } from "./useAiSuggestion.js";

/**
 * Harness com `useState` REAL pra `detailTagIds`/`detailTagLabelById` — só
 * assim dá pra observar se uma chamada MESCLOU ou SUBSTITUIU o valor
 * anterior. Os demais setters seguem mockados (irrelevantes pro que estes
 * testes provam).
 */
function useHarness({ ensureDetailTag, desc, useLiveDetailTags = true, setTxSubmitError }) {
  const [detailTagIds, setDetailTagIds] = useState([]);
  const [detailTagLabelById, setDetailTagLabelById] = useState({});
  // `useRef` — precisam ser a MESMA instância de mock em todo render, senão
  // `result.current.setTags` (lido DEPOIS de `applyAi` já ter causado
  // re-renders internos) aponta pra um mock diferente do que foi realmente
  // chamado.
  const setCat = useRef(vi.fn()).current;
  const setCategoryTagId = useRef(vi.fn()).current;
  const setTags = useRef(vi.fn()).current;

  const ai = useAiSuggestion({
    desc,
    useLiveCategoryTags: true,
    useLiveDetailTags,
    categoryTagsData: { categories: [{ id: "cat-mercado", labelPt: "Alimentação", iconKey: "shopping-cart" }] },
    ensureDetailTag,
    setCat,
    setCategoryTagId,
    setDetailTagIds,
    setDetailTagLabelById,
    setTags,
    setTxSubmitError,
  });

  return { ...ai, detailTagIds, setDetailTagIds, detailTagLabelById, setCat, setCategoryTagId, setTags };
}

function setup(overrides = {}) {
  const ensureDetailTag = vi.fn();
  const setTxSubmitError = vi.fn();

  const { result, rerender } = renderHook(
    ({ desc }) => useHarness({ ensureDetailTag, desc, setTxSubmitError, ...overrides }),
    { initialProps: { desc: "" } },
  );

  return { result, rerender, ensureDetailTag, setTxSubmitError };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAiSuggestion — rodada 3, achado 1: mescla em vez de substituir detailTagIds", () => {
  it("tag de detalhe escolhida à MÃO antes de 'Aplicar' sobrevive — não é apagada pela sugestão de IA", async () => {
    const { result, rerender, ensureDetailTag } = setup();
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    // Pessoa já tinha escolhido uma tag de detalhe manualmente (ex.: quick-add).
    act(() => {
      result.current.setDetailTagIds(["id-manual-do-usuario"]);
    });
    expect(result.current.detailTagIds).toEqual(["id-manual-do-usuario"]);

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    // A tag escolhida à mão continua lá — a IA só ACRESCENTA as suas.
    expect(result.current.detailTagIds).toEqual(
      expect.arrayContaining(["id-manual-do-usuario", "id-mercado", "id-compras"]),
    );
    expect(result.current.detailTagIds).toHaveLength(3);
    expect(result.current.aiApplied).toBe(true);
  });

  it("retry depois de falha parcial não apaga a tag que já tinha resolvido no 1º clique", async () => {
    const { result, rerender, ensureDetailTag } = setup();
    ensureDetailTag.mockImplementationOnce(async () => "id-mercado"); // "mercado" ok
    ensureDetailTag.mockRejectedValueOnce(new Error("carregando")); // "compras" falha

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });
    expect(result.current.detailTagIds).toEqual(["id-mercado"]);
    expect(result.current.aiApplied).toBe(false);

    // Catálogo termina de carregar — retry resolve as duas.
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);
    await act(async () => {
      await result.current.applyAi();
    });

    expect(result.current.detailTagIds).toEqual(
      expect.arrayContaining(["id-mercado", "id-compras"]),
    );
    expect(result.current.aiApplied).toBe(true);
  });

  it("labelById também mescla (não perde rótulos já resolvidos)", async () => {
    const { result, rerender, ensureDetailTag } = setup();
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(result.current.detailTagLabelById).toEqual({
      "id-mercado": "mercado",
      "id-compras": "compras",
    });
  });
});

describe("useAiSuggestion — rodada 3, achado 3: falha vira erro visível, não silêncio", () => {
  it("ensureDetailTag rejeita para TODAS as tags: setTxSubmitError recebe a mensagem (mesmo canal de addQuickDetailTag)", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup();
    ensureDetailTag.mockRejectedValue(new Error("Ainda carregando as tags — tente novamente em instantes."));

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(setTxSubmitError).toHaveBeenCalledWith(
      "Ainda carregando as tags — tente novamente em instantes.",
    );
    expect(result.current.aiApplied).toBe(false);
  });

  it("falha parcial (1 de 2 tags): também expõe a mensagem", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup();
    ensureDetailTag.mockImplementationOnce(async () => "id-mercado");
    ensureDetailTag.mockRejectedValueOnce(new Error("Ainda carregando as tags — tente novamente em instantes."));

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(setTxSubmitError).toHaveBeenCalledWith(
      "Ainda carregando as tags — tente novamente em instantes.",
    );
  });

  it("ensureDetailTag resolve normalmente: NÃO chama setTxSubmitError com erro (só limpa no início)", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup();
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    // Só a limpeza inicial ("") — nenhuma mensagem de erro de verdade.
    expect(setTxSubmitError).toHaveBeenCalledWith("");
    expect(setTxSubmitError).not.toHaveBeenCalledWith(
      expect.stringMatching(/./),
    );
  });

  it("modo NÃO live: comportamento antigo preservado (setTags recebe as tags cruas, sem tocar em setTxSubmitError)", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup({ useLiveDetailTags: false });

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(ensureDetailTag).not.toHaveBeenCalled();
    expect(result.current.setTags).toHaveBeenCalledWith(["mercado", "compras"]);
    expect(setTxSubmitError).not.toHaveBeenCalled();
    expect(result.current.aiApplied).toBe(true);
  });
});
