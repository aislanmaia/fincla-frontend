import { describe, expect, it } from "vitest";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
  mapRecurringSeriesToUi,
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

describe("mapRecurringSeriesToUi — tags de detalhe da série", () => {
  const seriesTag = (id, name, typeName, extra = {}) => ({
    id,
    name,
    color: null,
    is_default: false,
    is_active: true,
    organization_id: "org-1",
    tag_type: typeName ? { id: `type-${typeName}`, name: typeName } : null,
    ...extra,
  });
  const baseSeries = (tags) => ({
    id: "series-1",
    description: "Aluguel da casa",
    type: "expense",
    value: "800.00",
    frequency: "monthly",
    payment_method: "pix",
    is_active: true,
    tags,
  });

  it("separa as tags de detalhe da categoria", () => {
    const ui = mapRecurringSeriesToUi(
      baseSeries([seriesTag(CAT, "Housing", "categoria"), seriesTag(D1, "aluguel", "detalhe")]),
    );
    expect(ui.categoryTagId).toBe(CAT);
    expect(ui.detailTags.map((t) => t.id)).toEqual([D1]);
  });

  it("série sem tags de detalhe devolve lista vazia", () => {
    const ui = mapRecurringSeriesToUi(baseSeries([seriesTag(CAT, "Housing", "categoria")]));
    expect(ui.detailTags).toEqual([]);
  });

  it("nenhuma tag da série some no ciclo editar → salvar, mesmo uma segunda categoria", () => {
    const SECOND_CAT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const ui = mapRecurringSeriesToUi(
      baseSeries([
        seriesTag(CAT, "Housing", "categoria"),
        seriesTag(SECOND_CAT, "Transport", "categoria"),
        seriesTag(D1, "aluguel", "detalhe"),
      ]),
    );
    const payload = buildUpdateRecurringSeriesPayload({
      description: ui.desc,
      value: ui.val,
      paymentMethodKey: "pix",
      categoryTagId: ui.categoryTagId,
      detailTagIds: ui.detailTags.map((t) => t.id),
      startDateYmd: "2026-05-26",
      freqRec: "mensal",
      encRec: "sem-fim",
      valorTipoRec: "fixo",
    });
    expect([...payload.tag_ids].sort()).toEqual([CAT, SECOND_CAT, D1].sort());
  });

  it("tags sem tag_type também sobrevivem ao ciclo", () => {
    const ui = mapRecurringSeriesToUi(
      baseSeries([seriesTag(CAT, "Housing", null), seriesTag(D1, "aluguel", null)]),
    );
    expect(ui.categoryTagId).toBe(CAT);
    expect(ui.detailTags.map((t) => t.id)).toEqual([D1]);
  });
});
