import { describe, expect, it } from "vitest";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
} from "../recurringSeriesAdapter.js";

const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const D1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("buildCreateRecurringSeriesPayload — detailTagIds", () => {
  it("mescla categoria e tags de detalhe em tag_ids", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Aluguel",
      value: 1500,
      paymentMethodKey: "pix",
      categoryTagId: CAT,
      detailTagIds: [D1, CAT],
      startDateYmd: "2026-04-01",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: undefined,
      valorTipoRec: "fixo",
      categoryLabel: "Moradia",
      cardId: null,
    });
    expect(p.tag_ids).toEqual([CAT, D1]);
  });
});

describe("buildUpdateRecurringSeriesPayload — detailTagIds", () => {
  it("inclui detalhes além da categoria", () => {
    const p = buildUpdateRecurringSeriesPayload({
      description: "Novo valor",
      value: 1600,
      paymentMethodKey: "pix",
      categoryTagId: CAT,
      detailTagIds: [D1],
      startDateYmd: "2026-04-01",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: undefined,
      valorTipoRec: "fixo",
      categoryLabel: "Moradia",
      cardId: null,
    });
    expect(p.tag_ids).toEqual([CAT, D1]);
  });
});
