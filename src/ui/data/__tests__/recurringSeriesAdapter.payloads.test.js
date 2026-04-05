import { describe, expect, it } from "vitest";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
  mapUiFreqRecToApi,
} from "../recurringSeriesAdapter.js";

describe("recurringSeriesAdapter payloads", () => {
  it("mapUiFreqRecToApi mapeia frequências da UI", () => {
    expect(mapUiFreqRecToApi("mensal")).toBe("monthly");
    expect(mapUiFreqRecToApi("semanal")).toBe("weekly");
    expect(mapUiFreqRecToApi("quinzenal")).toBe("biweekly");
    expect(mapUiFreqRecToApi("anual")).toBe("yearly");
  });

  it("buildCreateRecurringSeriesPayload define day_of_month para mensal", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Luz",
      value: 100,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2025-03-15",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
    });
    expect(p.frequency).toBe("monthly");
    expect(p.day_of_month).toBe(15);
    expect(p.type).toBe("expense");
    expect(p.end_date).toBeUndefined();
  });

  it("buildCreateRecurringSeriesPayload envia end_date quando encerra em data", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "X",
      value: 50,
      paymentMethodKey: "boleto",
      categoryTagId: null,
      startDateYmd: "2025-01-01",
      freqRec: "mensal",
      encRec: "data",
      endDateYmd: "2025-12-31",
      valorTipoRec: "estimado",
      categoryLabel: "Cat",
    });
    expect(p.end_date).toBe("2025-12-31");
    expect(p.value_kind).toBe("approximate");
    expect(p.category).toBe("Cat");
  });

  it("buildCreateRecurringSeriesPayload define day_of_week a partir de start_date para semanal", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "receita",
      description: "Salário",
      value: 3000,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2025-01-06",
      freqRec: "semanal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
    });
    expect(p.frequency).toBe("weekly");
    expect(p.day_of_week).toBe(new Date("2025-01-06T12:00:00").getDay());
  });

  it("buildUpdateRecurringSeriesPayload envia end_date null para sem-fim", () => {
    const p = buildUpdateRecurringSeriesPayload({
      description: "Y",
      value: 10,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2025-02-01",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
    });
    expect(p.end_date).toBeNull();
  });
});
