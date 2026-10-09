import { describe, expect, it } from "vitest";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
  buildEditRecurringPreConfig,
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

describe("mapRecurringSeriesToUi — tags de detalhe para o modal de edição", () => {
  const seriesTag = (id, name, typeName, extra = {}) => ({
    id,
    name,
    color: null,
    is_default: false,
    is_active: true,
    organization_id: "org-1",
    tag_type: { id: `type-${typeName}`, name: typeName },
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
      baseSeries([
        seriesTag(CAT, "Housing", "categoria"),
        seriesTag(D1, "aluguel", "detalhe"),
      ]),
    );
    expect(ui.categoryTagId).toBe(CAT);
    expect(ui.detailTagIds).toEqual([D1]);
    expect(ui.detailTagDisplayById).toEqual({ [D1]: "aluguel" });
    expect(ui.detailTagMetaById[D1]).toMatchObject({ name: "aluguel", isActive: true });
  });

  it("marca como indisponível a tag de detalhe inativa", () => {
    const ui = mapRecurringSeriesToUi(
      baseSeries([
        seriesTag(CAT, "Housing", "categoria"),
        seriesTag(D1, "aluguel", "detalhe", { is_active: false }),
      ]),
    );
    expect(ui.detailTagMetaById[D1].isActive).toBe(false);
  });

  it("série sem tags de detalhe devolve listas vazias", () => {
    const ui = mapRecurringSeriesToUi(baseSeries([seriesTag(CAT, "Housing", "categoria")]));
    expect(ui.detailTagIds).toEqual([]);
    expect(ui.detailTagDisplayById).toEqual({});
  });

  it("o round-trip editar → salvar preserva as tags de detalhe", () => {
    const ui = mapRecurringSeriesToUi(
      baseSeries([
        seriesTag(CAT, "Housing", "categoria"),
        seriesTag(D1, "aluguel", "detalhe"),
      ]),
    );
    const payload = buildUpdateRecurringSeriesPayload({
      description: ui.desc,
      value: ui.val,
      paymentMethodKey: "pix",
      categoryTagId: ui.categoryTagId,
      detailTagIds: ui.detailTagIds,
      startDateYmd: "2026-05-26",
      freqRec: "mensal",
      encRec: "sem-fim",
      valorTipoRec: "fixo",
    });
    expect(payload.tag_ids).toEqual([CAT, D1]);
  });
});

describe("buildEditRecurringPreConfig — abertura do modal de edição", () => {
  const seriesWithDetailTag = {
    id: "series-1",
    description: "Aluguel da casa",
    type: "expense",
    value: "800.00",
    frequency: "monthly",
    payment_method: "pix",
    is_active: true,
    day_of_month: 26,
    start_date: "2026-05-26",
    tags: [
      {
        id: CAT,
        name: "Housing",
        is_active: true,
        tag_type: { id: "t1", name: "categoria" },
      },
      {
        id: D1,
        name: "aluguel",
        is_active: true,
        tag_type: { id: "t2", name: "detalhe" },
      },
    ],
  };

  it("leva as tags de detalhe da série para o preConfig (senão o salvamento as apaga)", () => {
    const preConfig = buildEditRecurringPreConfig(mapRecurringSeriesToUi(seriesWithDetailTag));
    expect(preConfig.isEditRecorrencia).toBe(true);
    expect(preConfig.recId).toBe("series-1");
    expect(preConfig.categoryTagId).toBe(CAT);
    expect(preConfig.detailTagIds).toEqual([D1]);
    expect(preConfig.detailTagDisplayById).toEqual({ [D1]: "aluguel" });
    expect(preConfig.detailTagMetaById[D1].isActive).toBe(true);
  });

  it("preserva a frequência e o dia do mês da série", () => {
    const preConfig = buildEditRecurringPreConfig(mapRecurringSeriesToUi(seriesWithDetailTag));
    expect(preConfig.freqRec).toBe("mensal");
    expect(preConfig.selectedDayOfMonth).toBe(26);
    expect(preConfig.encRec).toBe("sem-fim");
  });
});
