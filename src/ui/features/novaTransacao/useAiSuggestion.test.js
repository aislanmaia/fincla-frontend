// @vitest-environment jsdom
//
// fincla-frontend#109 achado 4 (revisão da PR #109) — `ensureDetailTag` agora
// pode rejeitar de propósito (catálogo de tags ainda carregando — fail-closed
// do fincla-frontend#101), e a sugestão de IA é heurística LOCAL e SÍNCRONA:
// nada impede o clique em "Aplicar" antes do catálogo terminar de carregar.
// Antes desta correção, uma rejeição por tag caía num `catch { /* ignora */ }`
// e a tag desaparecia em silêncio, mesmo com `setAiApplied(true)` afirmando
// que tudo foi aplicado.
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

describe("useAiSuggestion — achado 4: tag que falha em ensureDetailTag não desaparece", () => {
  it("ensureDetailTag rejeita (catálogo carregando): a tag cai como texto livre, não some", async () => {
    const { result, rerender, ensureDetailTag, setDetailTagIds, setDetailTagLabelById, setTags } = setup();
    ensureDetailTag.mockRejectedValue(new Error("Ainda carregando as tags — tente novamente em instantes."));

    rerender({ desc: "mercado extra" });
    await waitFor(() => expect(result.current.aiSuggestion).toBeTruthy());
    expect(result.current.aiSuggestion.tags).toEqual(["mercado", "compras"]);

    await act(async () => {
      await result.current.applyAi();
    });

    // Nenhuma tag de detalhe resolvida (todas rejeitaram)...
    expect(setDetailTagIds).toHaveBeenCalledWith([]);
    expect(setDetailTagLabelById).toHaveBeenCalledWith({});
    // ...mas elas não podem ter sumido: caem como tags de texto livre.
    expect(setTags).toHaveBeenCalledWith(["mercado", "compras"]);
  });

  it("ensureDetailTag resolve normalmente: comportamento antigo preservado (tags resolvidas, sem texto livre)", async () => {
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
    // Sem falhas, não sobra nenhuma tag de texto livre.
    expect(setTags).toHaveBeenCalledWith([]);
  });

  it("falha parcial (1 de 2 tags rejeita): a que resolveu vira id, a que falhou vira texto livre", async () => {
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
    expect(setTags).toHaveBeenCalledWith(["compras"]);
  });
});
