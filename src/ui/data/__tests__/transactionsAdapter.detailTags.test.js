import { describe, expect, it } from "vitest";
import {
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
  mapApiTransactionToUi,
  pickDetailTagDisplayMapFromApiTransaction,
  pickNonCategoryTagIdsFromApiTransaction,
} from "../transactionsAdapter.js";

const CAT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DET1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DET2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function tagStub(id, name, typeName, parentId = null) {
  return {
    id,
    name,
    color: null,
    is_default: false,
    is_active: true,
    organization_id: "org-1",
    sort_order: 0,
    is_onboarding_highlight: false,
    icon_key: null,
    parent_category_tag_id: parentId,
    tag_type: {
      id: `${typeName}-type`,
      name: typeName,
      description: null,
      is_required: false,
      max_per_transaction: null,
    },
  };
}

function minimalTransaction(overrides = {}) {
  return {
    id: 42,
    organization_id: "org-1",
    type: "expense",
    description: "Compra",
    value: 99.5,
    payment_method: "pix",
    date: "2026-03-15T12:00:00",
    status: "completed",
    recurring: false,
    created_at: "2026-03-15T12:00:00",
    updated_at: "2026-03-15T12:00:00",
    tags: {
      categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
      detalhe: [
        tagStub(DET1, "família", "detalhe", CAT_ID),
        tagStub(DET2, "semanal", "detalhe", CAT_ID),
      ],
    },
    ...overrides,
  };
}

describe("pickNonCategoryTagIdsFromApiTransaction", () => {
  it("exclui o id da tag de categoria e mantém ordem estável de detalhes", () => {
    const tx = minimalTransaction();
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1, DET2]);
  });

  it("ignora outras tags do tipo categoria no mesmo grupo (ex.: Transport vs Transporte)", () => {
    const transportCatId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const tx = minimalTransaction({
      tags: {
        categoria: [
          tagStub(CAT_ID, "Transporte", "categoria", null),
          tagStub(transportCatId, "Transport", "categoria", null),
        ],
        detalhe: [tagStub(DET1, "combustível", "detalhe", CAT_ID)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("ignora detalhes cuja categoria pai não é a categoria principal da transação", () => {
    const otherCat = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const detOther = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Transporte", "categoria", null)],
        detalhe: [
          tagStub(DET1, "combustível", "detalhe", CAT_ID),
          tagStub(detOther, "outro", "detalhe", otherCat),
        ],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("deduplica ids repetidos em grupos diferentes", () => {
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Cat", "categoria", null)],
        detalhe: [tagStub(DET1, "a", "detalhe", CAT_ID)],
        outro: [tagStub(DET1, "a", "detalhe", CAT_ID)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });

  it("com categoria legada sem id, devolve todos os ids das tags", () => {
    const tx = minimalTransaction({
      category: "Legado",
      tags: {
        detalhe: [tagStub(DET1, "x", "detalhe", null)],
      },
    });
    expect(pickNonCategoryTagIdsFromApiTransaction(tx)).toEqual([DET1]);
  });
});

describe("mapApiTransactionToUi — detailTagIds", () => {
  it("expõe detailTagIds alinhados ao pick", () => {
    const ui = mapApiTransactionToUi(minimalTransaction());
    expect(ui.detailTagIds).toEqual([DET1, DET2]);
    expect(ui.tags.map(String)).toContain("família");
  });

  it("expõe detailTagDisplayById com nome por id (chips no modal)", () => {
    const ui = mapApiTransactionToUi(minimalTransaction());
    expect(ui.detailTagDisplayById[DET1]).toBe("família");
    expect(ui.detailTagDisplayById[DET2]).toBe("semanal");
  });
});

describe("pickDetailTagDisplayMapFromApiTransaction", () => {
  it("usa placeholder curto quando a tag não tem nome", () => {
    const ghost = "c4eee2bc-d728-45a9-ae2e-8444af0006d5";
    const tx = minimalTransaction({
      tags: {
        categoria: [tagStub(CAT_ID, "Alimentação", "categoria", null)],
        detalhe: [
          tagStub(DET1, "combustível", "detalhe", CAT_ID),
          {
            ...tagStub(ghost, "", "detalhe", CAT_ID),
            name: "",
          },
        ],
      },
    });
    const m = pickDetailTagDisplayMapFromApiTransaction(tx);
    expect(m[DET1]).toBe("combustível");
    expect(m[ghost]).toBe(`Tag ${ghost.slice(0, 8)}…`);
  });
});

describe("buildCreateTransactionPayload — detailTagIds", () => {
  it("inclui categoria e detalhes sem duplicar a categoria", () => {
    const payload = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Teste",
      value: 10,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: [DET1, CAT_ID, DET2],
      dateIso: "2026-01-01T12:00:00",
    });
    expect(payload.tag_ids).toEqual([CAT_ID, DET1, DET2]);
  });

  it("sem detalhes mantém só a categoria", () => {
    const payload = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Teste",
      value: 10,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: null,
      dateIso: "2026-01-01T12:00:00",
    });
    expect(payload.tag_ids).toEqual([CAT_ID]);
  });
});

describe("buildUpdateTransactionPayload — detailTagIds", () => {
  it("quando há categoryTagId, envia tag_ids completos", () => {
    const payload = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: "Atualizado",
      value: 20,
      paymentMethodKey: "pix",
      categoryTagId: CAT_ID,
      detailTagIds: [DET2],
      dateIso: "2026-01-02T12:00:00",
      recurring: false,
    });
    expect(payload.tag_ids).toEqual([CAT_ID, DET2]);
  });

  it("sem categoryTagId não define tag_ids", () => {
    const payload = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: "X",
      value: 1,
      paymentMethodKey: "pix",
      categoryTagId: null,
      detailTagIds: [DET1],
      dateIso: "2026-01-02T12:00:00",
    });
    expect(payload.tag_ids).toBeUndefined();
  });
});
