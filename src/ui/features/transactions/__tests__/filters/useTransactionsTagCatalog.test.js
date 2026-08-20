// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as tagsApi from "../../../../../api/tags";
import { useTransactionsTagCatalog } from "../../filters/useTransactionsTagCatalog.js";

// fincla-frontend#96 — revisão adversarial da PR #96, prioridade 5: este hook
// não tinha NENHUM teste (só era mockado no único arquivo que o importa,
// TransacoesPage.rtl.test.jsx). Ele é a fonte de dados de todo o achado 6
// (catálogo com TODOS os tipos não-categoria, não só `detalhe`) e do fail
// closed do achado 4 (limpar `rows` antes do refetch na troca de organização).

vi.mock("../../../../../api/tags", () => ({
  listTags: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";

function tagRow(id, name, typeName, parentId = null) {
  return {
    id,
    name,
    tag_type: { id: `tt-${typeName}`, name: typeName },
    parent_category_tag_id: parentId,
  };
}

describe("useTransactionsTagCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("desligado não chama a API", () => {
    renderHook(() => useTransactionsTagCatalog({ organizationId: ORG, enabled: false }));
    expect(tagsApi.listTags).not.toHaveBeenCalled();
  });

  it("sem organizationId não chama a API mesmo com enabled=true", () => {
    renderHook(() => useTransactionsTagCatalog({ organizationId: null, enabled: true }));
    expect(tagsApi.listTags).not.toHaveBeenCalled();
  });

  it("busca o catálogo inteiro (sem tag_type) — achado 6, não só 'detalhe'", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({ tags: [] });
    renderHook(() => useTransactionsTagCatalog({ organizationId: ORG, enabled: true }));
    await waitFor(() => expect(tagsApi.listTags).toHaveBeenCalledWith(ORG));
  });

  it("mantém detalhe/contexto/local/pessoa e exclui só categoria", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [
        tagRow("cat-1", "Alimentação", "categoria"),
        tagRow("det-1", "mensal", "detalhe", "cat-1"),
        tagRow("ctx-1", "viagem", "contexto"),
        tagRow("loc-1", "casa", "local"),
        tagRow("pes-1", "joão", "pessoa"),
      ],
    });

    const { result } = renderHook(() =>
      useTransactionsTagCatalog({ organizationId: ORG, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const names = result.current.rows.map((r) => r.name).sort();
    expect(names).toEqual(["casa", "joão", "mensal", "viagem"]);
    expect(names).not.toContain("Alimentação");
  });

  it("exclui categoria com grafia variante ('Categoria', maiúscula/acento) — normaliza antes de comparar", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [tagRow("cat-1", "Transporte", "Categoria"), tagRow("det-1", "uber", "detalhe")],
    });

    const { result } = renderHook(() =>
      useTransactionsTagCatalog({ organizationId: ORG, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.map((r) => r.name)).toEqual(["uber"]);
  });

  it("erro na API vira `error` e `rows` fica vazio", async () => {
    vi.mocked(tagsApi.listTags).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() =>
      useTransactionsTagCatalog({ organizationId: ORG, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
    expect(result.current.rows).toEqual([]);
  });

  // Achado 4 aplicado a este hook (é a fonte usada por TransacoesPage):
  // trocar de organização não pode deixar `rows` com as tags da org ANTERIOR
  // enquanto o novo fetch está a caminho.
  it("troca de organização limpa `rows` ANTES do novo fetch resolver", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValueOnce({
      tags: [tagRow("det-1", "mensal", "detalhe")],
    });

    const { result, rerender } = renderHook(
      ({ organizationId }) => useTransactionsTagCatalog({ organizationId, enabled: true }),
      { initialProps: { organizationId: ORG } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);

    const ORG_B = "22222222-2222-4222-8222-222222222222";
    let resolveOrgB;
    const orgBPromise = new Promise((resolve) => {
      resolveOrgB = resolve;
    });
    vi.mocked(tagsApi.listTags).mockReturnValueOnce(orgBPromise);

    rerender({ organizationId: ORG_B });

    // Antes de resolver, `rows` já não pode ter a tag da org A.
    expect(result.current.rows).toEqual([]);

    resolveOrgB({ tags: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([]);
  });
});
