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

function detailRow(id, name, parentId) {
  return {
    id,
    name,
    color: null,
    is_default: false,
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

    expect(tagsApi.listTags).toHaveBeenCalledWith(ORG, "detalhe");
    const row = result.current.findByLabel("família");
    expect(row?.id).toBe(DET_EXISTING);
    expect(result.current.labelForDetailId(DET_EXISTING)).toBe("família");
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
});
