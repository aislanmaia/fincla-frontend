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

  it("buildUpdateRecurringSeriesPayload sempre inclui start_date (regression: edição de data)", () => {
    const p = buildUpdateRecurringSeriesPayload({
      description: "Z",
      value: 100,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-06-20",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      dayOfMonth: 5,
    });
    expect(p.start_date).toBe("2026-06-20");
  });

  it("mapUiFreqRecToApi mapeia personalizado para custom", () => {
    expect(mapUiFreqRecToApi("personalizado")).toBe("custom");
  });

  it("buildCreate envia interval/interval_unit para personalizado", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Vacina pet",
      value: 200,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-01-10",
      freqRec: "personalizado",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      interval: 3,
      intervalUnit: "month",
    });
    expect(p.frequency).toBe("custom");
    expect(p.interval).toBe(3);
    expect(p.interval_unit).toBe("month");
    expect(p.day_of_month).toBeUndefined();
    expect(p.day_of_week).toBeUndefined();
  });

  it("buildCreate usa dayOfWeek explícito do form em vez de derivar da start_date", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Aula",
      value: 80,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-05-22", // sexta
      freqRec: "semanal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      dayOfWeek: 2, // terça
    });
    expect(p.day_of_week).toBe(2);
  });

  it("buildCreate usa dayOfMonth explícito do form em vez de derivar da start_date", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Aluguel",
      value: 1800,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-05-22",
      freqRec: "mensal",
      encRec: "sem-fim",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      dayOfMonth: 5,
    });
    expect(p.day_of_month).toBe(5);
  });

  it("buildCreate converte 'repetições' em end_date (mensal × 12)", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Internet",
      value: 100,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-01-05",
      freqRec: "mensal",
      encRec: "repeticoes",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      dayOfMonth: 5,
      repetitions: 12,
    });
    // 12 ocorrências mensais começando em 2026-01-05 → última cai em 2026-12-05
    expect(p.end_date).toBe("2026-12-05");
  });

  it("buildCreate converte 'repetições' em end_date para personalizado (a cada 3 meses × 4)", () => {
    const p = buildCreateRecurringSeriesPayload({
      tipo: "despesa",
      description: "Vacina pet",
      value: 200,
      paymentMethodKey: "pix",
      categoryTagId: null,
      startDateYmd: "2026-01-10",
      freqRec: "personalizado",
      encRec: "repeticoes",
      endDateYmd: null,
      valorTipoRec: "fixo",
      categoryLabel: null,
      interval: 3,
      intervalUnit: "month",
      repetitions: 4,
    });
    // 4 ocorrências começando 2026-01-10, a cada 3 meses → última = 2026-10-10
    expect(p.end_date).toBe("2026-10-10");
  });

  it("não mapeia diário/custom como aliases silenciosos (mapUiFreqRecToApi cai em mensal)", () => {
    // Diário foi removido da UI; se vier algo desconhecido, default seguro = monthly
    expect(mapUiFreqRecToApi("diário")).toBe("monthly");
    expect(mapUiFreqRecToApi("custom")).toBe("monthly");
  });
});
