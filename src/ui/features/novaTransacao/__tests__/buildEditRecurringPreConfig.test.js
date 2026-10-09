import { describe, expect, it } from "vitest";
import { mapRecurringSeriesToUi } from "../../../data/recurringSeriesAdapter.js";
import { buildEditRecurringPreConfig } from "../buildEditRecurringPreConfig.js";

const CAT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const D1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const series = (detailTagOverrides = {}) => ({
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
    { id: CAT, name: "Housing", is_active: true, tag_type: { id: "t1", name: "categoria" } },
    {
      id: D1,
      name: "aluguel",
      is_active: true,
      tag_type: { id: "t2", name: "detalhe" },
      ...detailTagOverrides,
    },
  ],
});

describe("buildEditRecurringPreConfig", () => {
  it("leva as tags de detalhe da série para o preConfig (senão o salvamento as apaga)", () => {
    const preConfig = buildEditRecurringPreConfig(mapRecurringSeriesToUi(series()));

    expect(preConfig.isEditRecorrencia).toBe(true);
    expect(preConfig.recId).toBe("series-1");
    expect(preConfig.categoryTagId).toBe(CAT);
    expect(preConfig.detailTagIds).toEqual([D1]);
    expect(preConfig.detailTagDisplayById).toEqual({ [D1]: "aluguel" });
    expect(preConfig.detailTagMetaById[D1]).toMatchObject({ name: "aluguel", isActive: true });
  });

  it("marca a tag de detalhe inativa como indisponível", () => {
    const preConfig = buildEditRecurringPreConfig(
      mapRecurringSeriesToUi(series({ is_active: false })),
    );

    expect(preConfig.detailTagMetaById[D1].isActive).toBe(false);
  });

  it("série sem tags de detalhe abre com listas vazias", () => {
    const withoutDetail = series();
    withoutDetail.tags = withoutDetail.tags.slice(0, 1);
    const preConfig = buildEditRecurringPreConfig(mapRecurringSeriesToUi(withoutDetail));

    expect(preConfig.detailTagIds).toEqual([]);
    expect(preConfig.detailTagDisplayById).toEqual({});
  });

  it("linha fora do mapper da API (onboarding) cai nos rótulos de exibição", () => {
    const preConfig = buildEditRecurringPreConfig({
      id: "seed-1",
      desc: "Netflix",
      tipo: "despesa",
      val: 40,
      freq: "Mensal",
      enc: "Após N repetições",
      metodo: "Cartão crédito",
    });

    expect(preConfig).toMatchObject({
      freqRec: "mensal",
      encRec: "repeticoes",
      method: "credito",
      detailTagIds: [],
    });
  });

  it("preserva frequência e dia do mês da série", () => {
    const preConfig = buildEditRecurringPreConfig(mapRecurringSeriesToUi(series()));

    expect(preConfig.freqRec).toBe("mensal");
    expect(preConfig.selectedDayOfMonth).toBe(26);
    expect(preConfig.encRec).toBe("sem-fim");
  });
});
