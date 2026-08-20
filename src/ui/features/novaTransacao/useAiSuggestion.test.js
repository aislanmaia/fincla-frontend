// @vitest-environment jsdom
//
// fincla-frontend#109 — quatro rodadas de revisão sobre este hook:
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
//  - achado 1: `setDetailTagIds(nextIds)` SUBSTITUÍA a lista inteira — tags
//    de detalhe escolhidas à mão antes de "Aplicar" desapareciam. Corrigido
//    pra MESCLAR.
//  - achado 3: o `catch` engolia a mensagem de falha — corrigido pra expor
//    via `setTxSubmitError` (mesmo canal de `addQuickDetailTag`).
//
// Rodada 4 (achados 3 e 4) — a correção da rodada 3 (mesclar) criou DOIS
// problemas novos:
//  - achado 3: tags de detalhe são ESCOPADAS por `parent_category_tag_id`
//    (ver NovaTransacaoModal.jsx ~2318/3298: QUALQUER troca manual de
//    categoria zera as tags de detalhe, exatamente por causa disso).
//    Mesclar incondicionalmente misturava tags da categoria ANTERIOR com a
//    NOVA quando `applyAi` também troca a categoria — um vínculo pai↔filho
//    inconsistente, enviado ao backend sem nenhum aviso visível. Só mescla
//    quando a categoria NÃO muda; trocando, segue a mesma convenção das
//    outras trocas (substitui).
//  - achado 4: em modo live, o ramo destrutivo (`setDetailTagIds([])`)
//    continuava alcançável quando a categoria sugerida pela IA não bate com
//    NENHUMA categoria real da organização — apagava tags escolhidas à mão
//    e `aiApplied(true)` afirmava sucesso por cima do apagão. Corrigido pra
//    falhar fechado (nada muda, erro visível) ANTES de tocar em qualquer
//    setter.
import { useRef, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiSuggestion } from "./useAiSuggestion.js";

const CAT_ALIMENTACAO = "cat-mercado";
const CAT_TRANSPORTE = "cat-transporte";

/**
 * Harness com `useState` REAL pra `detailTagIds`/`detailTagLabelById`/
 * `categoryTagId` — só assim dá pra observar se uma chamada MESCLOU ou
 * SUBSTITUIU o valor anterior, e pra deixar `applyAi` ler a categoria
 * ATUAL corretamente numa 2ª chamada (retry, ou uma nova sugestão).
 */
function useHarness({
  ensureDetailTag,
  desc,
  useLiveDetailTags = true,
  setTxSubmitError,
  initialCategoryTagId = null,
}) {
  const [detailTagIds, setDetailTagIds] = useState([]);
  const [detailTagLabelById, setDetailTagLabelById] = useState({});
  const [categoryTagId, setCategoryTagId] = useState(initialCategoryTagId);
  // `useRef` — precisam ser a MESMA instância de mock em todo render, senão
  // `result.current.setTags` (lido DEPOIS de `applyAi` já ter causado
  // re-renders internos) aponta pra um mock diferente do que foi realmente
  // chamado.
  const setCat = useRef(vi.fn()).current;
  const setTags = useRef(vi.fn()).current;

  const ai = useAiSuggestion({
    desc,
    useLiveCategoryTags: true,
    useLiveDetailTags,
    categoryTagsData: {
      categories: [
        { id: CAT_ALIMENTACAO, labelPt: "Alimentação", iconKey: "shopping-cart" },
        { id: CAT_TRANSPORTE, labelPt: "Transporte", iconKey: "car" },
      ],
    },
    categoryTagId,
    ensureDetailTag,
    setCat,
    setCategoryTagId,
    setDetailTagIds,
    setDetailTagLabelById,
    setTags,
    setTxSubmitError,
  });

  return {
    ...ai,
    detailTagIds,
    setDetailTagIds,
    detailTagLabelById,
    categoryTagId,
    setCategoryTagId,
    setCat,
    setTags,
  };
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

describe("useAiSuggestion — rodada 3, achado 1 + rodada 4, achado 3: mescla só quando a categoria NÃO muda", () => {
  it("mesma categoria já selecionada: tag escolhida à MÃO sobrevive — a IA só ACRESCENTA", async () => {
    const { result, rerender, ensureDetailTag } = setup({ initialCategoryTagId: CAT_ALIMENTACAO });
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    // Pessoa já tinha "Alimentação" selecionada e escolhido uma tag de
    // detalhe manualmente (ex.: quick-add) sob ESSA categoria.
    act(() => {
      result.current.setDetailTagIds(["id-manual-do-usuario"]);
    });
    expect(result.current.detailTagIds).toEqual(["id-manual-do-usuario"]);

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    // A tag escolhida à mão continua lá — a IA só ACRESCENTA as suas
    // (mesma categoria, nada de escopo pai↔filho pra quebrar).
    expect(result.current.detailTagIds).toEqual(
      expect.arrayContaining(["id-manual-do-usuario", "id-mercado", "id-compras"]),
    );
    expect(result.current.detailTagIds).toHaveLength(3);
    expect(result.current.aiApplied).toBe(true);
  });

  it("categoria MUDA (Transporte -> Alimentação via IA): tag da categoria ANTERIOR não sobrevive — substitui, não mescla", async () => {
    const { result, rerender, ensureDetailTag } = setup({ initialCategoryTagId: CAT_TRANSPORTE });
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    // Pessoa tinha "Transporte" selecionada com uma tag "combustível" —
    // escopada em Transporte (parent_category_tag_id).
    act(() => {
      result.current.setDetailTagIds(["id-combustivel"]);
    });

    // Descrição dispara a sugestão de IA pra "Alimentação" (mercado).
    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());
    expect(result.current.aiSuggestion.cat).toBe("Alimentação");

    await act(async () => {
      await result.current.applyAi();
    });

    // A categoria mudou — "combustível" (escopado em Transporte) NÃO pode
    // sobreviver misturado com tags de Alimentação (vínculo pai↔filho
    // inconsistente, enviado sem nenhum aviso de "tag indisponível").
    expect(result.current.detailTagIds).toEqual(
      expect.arrayContaining(["id-mercado", "id-compras"]),
    );
    expect(result.current.detailTagIds).not.toContain("id-combustivel");
    expect(result.current.categoryTagId).toBe(CAT_ALIMENTACAO);
  });

  it("retry depois de falha parcial (mesma categoria o tempo todo) não apaga a tag que já tinha resolvido no 1º clique", async () => {
    const { result, rerender, ensureDetailTag } = setup({ initialCategoryTagId: CAT_ALIMENTACAO });
    ensureDetailTag.mockImplementationOnce(async () => "id-mercado"); // "mercado" ok
    ensureDetailTag.mockRejectedValueOnce(new Error("carregando")); // "compras" falha

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });
    expect(result.current.detailTagIds).toEqual(["id-mercado"]);
    expect(result.current.aiApplied).toBe(false);
    // Categoria já era a mesma (CAT_ALIMENTACAO) antes e depois — retry
    // mescla, não substitui.
    expect(result.current.categoryTagId).toBe(CAT_ALIMENTACAO);

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

  it("labelById também mescla quando a categoria não muda", async () => {
    const { result, rerender, ensureDetailTag } = setup({ initialCategoryTagId: CAT_ALIMENTACAO });
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

describe("useAiSuggestion — rodada 4, achado 4: categoria da IA sem correspondência na organização", () => {
  it("nenhuma categoria da organização bate com a sugestão: NADA muda (categoria, tags) e mostra erro — não aplica por cima do apagão", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup({
      initialCategoryTagId: CAT_TRANSPORTE,
    });

    // Pessoa já tinha Transporte + uma tag manual selecionadas.
    act(() => {
      result.current.setDetailTagIds(["id-combustivel"]);
    });

    // Descrição dispara uma regra cuja categoria ("Saúde") não existe no
    // catálogo mockado da organização (só Alimentação/Transporte).
    rerender({ desc: "farmácia remédio" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());
    expect(result.current.aiSuggestion.cat).toBe("Saúde");

    await act(async () => {
      await result.current.applyAi();
    });

    // Nada foi tocado: nem a categoria, nem as tags de detalhe.
    expect(result.current.setCat).not.toHaveBeenCalled();
    expect(result.current.categoryTagId).toBe(CAT_TRANSPORTE);
    expect(result.current.detailTagIds).toEqual(["id-combustivel"]);
    expect(ensureDetailTag).not.toHaveBeenCalled();

    // E a pessoa recebe uma explicação — não um "aplicado" falso.
    expect(setTxSubmitError).toHaveBeenCalledWith(
      expect.stringMatching(/não foi possível encontrar/i),
    );
    expect(result.current.aiApplied).toBe(false);
  });
});

describe("useAiSuggestion — rodada 3, achado 3: falha vira erro visível, não silêncio", () => {
  it("ensureDetailTag rejeita para TODAS as tags: setTxSubmitError recebe a mensagem (mesmo canal de addQuickDetailTag)", async () => {
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup({
      initialCategoryTagId: CAT_ALIMENTACAO,
    });
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
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup({
      initialCategoryTagId: CAT_ALIMENTACAO,
    });
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
    const { result, rerender, ensureDetailTag, setTxSubmitError } = setup({
      initialCategoryTagId: CAT_ALIMENTACAO,
    });
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
