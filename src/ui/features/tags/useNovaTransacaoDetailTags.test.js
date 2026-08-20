// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as tagsApi from "../../../api/tags";
import { useNovaTransacaoDetailTags } from "./useNovaTransacaoDetailTags.js";

vi.mock("../../../api/tags", () => ({
  listTagTypes: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DET_EXISTING = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function detailRow(id, name, parentId, isDefault = false) {
  return {
    id,
    name,
    color: null,
    is_default: isDefault,
    is_active: true,
    organization_id: ORG,
    sort_order: 0,
    is_onboarding_highlight: false,
    icon_key: null,
    parent_category_tag_id: parentId,
    tag_type: {
      id: "tt-det",
      name: "detalhe",
      description: null,
      is_required: false,
      max_per_transaction: null,
    },
  };
}

describe("useNovaTransacaoDetailTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tagsApi.listTagTypes).mockResolvedValue({
      tag_types: [
        {
          id: "tt-detalhe",
          name: "detalhe",
          description: null,
          is_required: false,
          max_per_transaction: null,
        },
      ],
    });
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [detailRow(DET_EXISTING, "família", CAT)],
    });
    vi.mocked(tagsApi.createTag).mockResolvedValue(
      detailRow("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "semanal", CAT),
    );
  });

  it("desligado não chama a API", () => {
    renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: false,
      }),
    );
    expect(tagsApi.listTags).not.toHaveBeenCalled();
  });

  it("carrega tags detalhe e findByLabel encontra por nome normalizado", async () => {
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Sem `status` (só ativas) — de propósito (achado 1, rodada 5 de
    // review #100): o backend REATIVA uma tag arquivada em `POST /tags`
    // pro mesmo nome; se este fetch trouxesse arquivadas, `ensureDetailTag`
    // devolveria o id da linha inativa sem reativar (ver
    // useNovaTransacaoDetailTags.js).
    expect(tagsApi.listTags).toHaveBeenCalledWith(ORG, "detalhe");
    const row = result.current.findByLabel("família");
    expect(row?.id).toBe(DET_EXISTING);
    expect(result.current.labelForDetailId(DET_EXISTING)).toBe("família");
  });

  it("labelForDetailId traduz nome cru do seed em inglês (regressão #77)", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [
        detailRow(DET_EXISTING, "família", CAT),
        detailRow("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "health_plan", CAT, true),
      ],
    });
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.labelForDetailId("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toBe(
      "plano de saúde",
    );
  });

  // Regressão do review adversarial da PR #97: o usuário só vê o rótulo PT
  // ("mercado") na tela — se ele digitar exatamente isso de volta, o app
  // precisa achar a tag seed "grocery" já existente, não criar uma duplicata.
  it("ensureDetailTag acha a tag seed pelo rótulo PT exibido, não só pelo nome cru (regressão #77)", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [detailRow("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "grocery", CAT, true)],
    });
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const id = await result.current.ensureDetailTag("mercado");
    expect(id).toBe("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    expect(tagsApi.createTag).not.toHaveBeenCalled();
    expect(result.current.findByLabel("mercado")?.id).toBe(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    );
  });

  // Regressão GRAVE do review adversarial da PR #97 (rodada 2, prioridade 4):
  // com "grocery" (seed) e "mercado" (tag própria do usuário) na MESMA
  // categoria, os dois exibem "mercado" na tela. `findByLabel("mercado")`
  // tinha que devolver a tag do usuário (nome cru bate exato), não a do seed
  // (só bate pelo rótulo traduzido) — senão a transação salva com o id
  // errado, e o erro é invisível porque os dois chips mostram o mesmo texto.
  it("rótulo ambíguo resolve pro nome cru exato antes do rótulo PT traduzido", async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [
        detailRow("seed-grocery-id", "grocery", CAT, true), // seed → exibe "mercado"
        detailRow("user-mercado-id", "mercado", CAT, false), // tag própria do usuário
      ],
    });
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.findByLabel("mercado")?.id).toBe("user-mercado-id");

    const id = await result.current.ensureDetailTag("mercado");
    expect(id).toBe("user-mercado-id");
    expect(tagsApi.createTag).not.toHaveBeenCalled();
  });

  it("ensureDetailTag cria tag quando não existe para o pai", async () => {
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const newId = await result.current.ensureDetailTag("semanal");
    expect(tagsApi.createTag).toHaveBeenCalledWith(ORG, {
      name: "semanal",
      tag_type_id: "tt-detalhe",
      parent_category_tag_id: CAT,
    });
    expect(newId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  });

  it("ensureDetailTag devolve id existente sem chamar createTag", async () => {
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: CAT,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const id = await result.current.ensureDetailTag("família");
    expect(id).toBe(DET_EXISTING);
    expect(tagsApi.createTag).not.toHaveBeenCalled();
  });

  // Regressão #100 (rodada 5 de review): a versão anterior deste teste
  // simulava `listTags` devolvendo uma tag ARQUIVADA — cenário que o hook
  // real NUNCA produz (sem `status`, a API só devolve ativas). Removido
  // junto com o revert de `status: "all"` (achado 1, rodada 5): o teste
  // provava um estado fabricado, não o comportamento real do app.

  it("aceita parent explícito (ex.: sugestão IA antes do setState da categoria)", async () => {
    const { result } = renderHook(() =>
      useNovaTransacaoDetailTags({
        organizationId: ORG,
        categoryTagId: null,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const id = await result.current.ensureDetailTag("semanal", CAT);
    expect(tagsApi.createTag).toHaveBeenCalled();
    expect(id).toBeTruthy();
  });

  // fincla-frontend#96 — revisão adversarial da PR #96, achado 4 (mesma classe
  // de bug aplicada por simetria a este hook, ainda usado pelo modal Nova
  // transação): trocar de organização não pode deixar `allDetailTags` com as
  // tags da organização ANTERIOR enquanto o novo fetch está a caminho — um
  // `ensureDetailTag`/`findByLabel` chamado nessa janela resolveria contra a
  // org errada, silenciosamente.
  it("troca de organização limpa allDetailTags ANTES do novo fetch resolver", async () => {
    const ORG_B = "22222222-2222-4222-8222-222222222222";
    let resolveOrgB;
    const orgBPromise = new Promise((resolve) => {
      resolveOrgB = resolve;
    });

    const { result, rerender } = renderHook(
      ({ organizationId }) =>
        useNovaTransacaoDetailTags({ organizationId, categoryTagId: CAT, enabled: true }),
      { initialProps: { organizationId: ORG } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allDetailTags).toHaveLength(1);

    // A próxima chamada (para ORG_B) fica pendente de propósito, para provar
    // que a limpeza acontece ANTES da resposta chegar.
    vi.mocked(tagsApi.listTags).mockReturnValueOnce(orgBPromise);
    rerender({ organizationId: ORG_B });

    // Implementação anterior: `allDetailTags` continuaria com a tag "família"
    // (da org A) até a promise de ORG_B resolver — janela de dado errado.
    expect(result.current.allDetailTags).toEqual([]);

    resolveOrgB({ tags: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allDetailTags).toEqual([]);
  });
});
