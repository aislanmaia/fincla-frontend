// @vitest-environment jsdom
//
// fincla-frontend#109 achado 4 (rodada 1) + achado 2 (rodada 2, revisão da
// PR #109) — `ensureDetailTag` pode rejeitar de propósito (catálogo de tags
// ainda carregando — fail-closed do fincla-frontend#101), e a sugestão de IA
// é heurística LOCAL e SÍNCRONA: nada impede o clique em "Aplicar" antes do
// catálogo terminar de carregar.
//
// A 1ª correção fazia a tag que falhasse cair em `setTags` (texto livre) —
// mas em modo live (`useLiveDetailTags`) `tags` é ESTADO MORTO: nem
// renderizado (os chips da seção "Tags" só leem `detailTagIds`) nem enviado
// (o payload só manda `detailTagIds`). A tag continuava sumindo em silêncio,
// com `aiApplied(true)` afirmando sucesso. A correção certa é: falha em
// QUALQUER tag não fecha como aplicado — o botão "Aplicar" continua
// disponível pra tentar de novo.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAiSuggestion } from "./useAiSuggestion.js";

function setup(overrides = {}) {
  const setCat = vi.fn();
  const setCategoryTagId = vi.fn();
  const setDetailTagIds = vi.fn();
  const setDetailTagLabelById = vi.fn();
  const setTags = vi.fn();
  const ensureDetailTag = vi.fn();

  const { result, rerender } = renderHook(
    ({ desc }) =>
      useAiSuggestion({
        desc,
        useLiveCategoryTags: true,
        useLiveDetailTags: true,
        categoryTagsData: { categories: [{ id: "cat-mercado", labelPt: "Alimentação", iconKey: "shopping-cart" }] },
        ensureDetailTag,
        setCat,
        setCategoryTagId,
        setDetailTagIds,
        setDetailTagLabelById,
        setTags,
        ...overrides,
      }),
    { initialProps: { desc: "" } },
  );

  return { result, rerender, setCat, setCategoryTagId, setDetailTagIds, setDetailTagLabelById, setTags, ensureDetailTag };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAiSuggestion — achado 2 (rodada 2): tag que falha não pode fechar como 'aplicado'", () => {
  it("ensureDetailTag rejeita para TODAS as tags: aiApplied continua false, setTags NUNCA é chamado (estado morto em modo live)", async () => {
    const { result, rerender, ensureDetailTag, setDetailTagIds, setDetailTagLabelById, setTags } = setup();
    ensureDetailTag.mockRejectedValue(new Error("Ainda carregando as tags — tente novamente em instantes."));

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());
    expect(result.current.aiSuggestion.tags).toEqual(["mercado", "compras"]);

    await act(async () => {
      await result.current.applyAi();
    });

    // Nenhuma tag resolvida...
    expect(setDetailTagIds).toHaveBeenCalledWith([]);
    expect(setDetailTagLabelById).toHaveBeenCalledWith({});
    // ...`setTags` é estado morto em modo live (não renderiza, não é
    // enviado) — não pode ser usado como "fallback" que nunca aparece.
    expect(setTags).not.toHaveBeenCalled();
    // E a tela NÃO PODE afirmar que aplicou — o botão "Aplicar" continua
    // disponível (é isso que `!aiApplied` controla em NovaTransacaoModal.jsx).
    expect(result.current.aiApplied).toBe(false);
  });

  it("ensureDetailTag resolve normalmente: tags resolvidas, aiApplied vira true, setTags não é chamado em modo live", async () => {
    const { result, rerender, ensureDetailTag, setDetailTagIds, setDetailTagLabelById, setTags } = setup();
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(setDetailTagIds).toHaveBeenCalledWith(["id-mercado", "id-compras"]);
    expect(setDetailTagLabelById).toHaveBeenCalledWith({
      "id-mercado": "mercado",
      "id-compras": "compras",
    });
    expect(setTags).not.toHaveBeenCalled();
    expect(result.current.aiApplied).toBe(true);
  });

  it("falha parcial (1 de 2 tags rejeita): a que resolveu vira id, aiApplied continua false (nem tudo foi aplicado)", async () => {
    const { result, rerender, ensureDetailTag, setDetailTagIds, setDetailTagLabelById, setTags } = setup();
    ensureDetailTag.mockImplementation(async (label) => {
      if (label === "mercado") return "id-mercado";
      throw new Error("Ainda carregando as tags — tente novamente em instantes.");
    });

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(setDetailTagIds).toHaveBeenCalledWith(["id-mercado"]);
    expect(setDetailTagLabelById).toHaveBeenCalledWith({ "id-mercado": "mercado" });
    expect(setTags).not.toHaveBeenCalled();
    expect(result.current.aiApplied).toBe(false);
  });

  it("retry depois de uma falha parcial: reenvia todas (idempotente pra quem já resolveu) e agora fecha como aplicado", async () => {
    const { result, rerender, ensureDetailTag, setDetailTagIds } = setup();
    ensureDetailTag.mockImplementationOnce(async () => "id-mercado"); // "mercado" ok
    ensureDetailTag.mockRejectedValueOnce(new Error("carregando")); // "compras" falha

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });
    expect(result.current.aiApplied).toBe(false);

    // Catálogo termina de carregar — retry resolve as duas.
    ensureDetailTag.mockImplementation(async (label) => `id-${label}`);
    await act(async () => {
      await result.current.applyAi();
    });

    expect(setDetailTagIds).toHaveBeenLastCalledWith(["id-mercado", "id-compras"]);
    expect(result.current.aiApplied).toBe(true);
  });

  it("modo NÃO live: comportamento antigo preservado (setTags recebe as tags cruas)", async () => {
    const { result, rerender, setTags, setDetailTagIds, setDetailTagLabelById, ensureDetailTag } = setup({
      useLiveDetailTags: false,
    });

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());

    await act(async () => {
      await result.current.applyAi();
    });

    expect(ensureDetailTag).not.toHaveBeenCalled();
    expect(setTags).toHaveBeenCalledWith(["mercado", "compras"]);
    expect(setDetailTagIds).toHaveBeenCalledWith([]);
    expect(setDetailTagLabelById).toHaveBeenCalledWith({});
    expect(result.current.aiApplied).toBe(true);
  });
});
