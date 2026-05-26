import { describe, expect, it } from "vitest";
import {
  computeEndDateFromOccurrences,
  computeFirstOccurrence,
  computeNextOccurrence,
  computeNthOccurrence,
} from "../recurrenceDateMath.js";

describe("computeFirstOccurrence", () => {
  it("monthly: avança para o próximo mês quando dia_do_mês já passou", () => {
    const first = computeFirstOccurrence(new Date(2026, 3, 10), "monthly", { dayOfMonth: 5 });
    expect(first).toEqual(new Date(2026, 4, 5));
  });

  it("monthly: mantém o mesmo mês quando dia_do_mês ainda é futuro", () => {
    const first = computeFirstOccurrence(new Date(2026, 3, 3), "monthly", { dayOfMonth: 15 });
    expect(first).toEqual(new Date(2026, 3, 15));
  });

  it("monthly: igualdade fica no mesmo dia", () => {
    const first = computeFirstOccurrence(new Date(2026, 3, 10), "monthly", { dayOfMonth: 10 });
    expect(first).toEqual(new Date(2026, 3, 10));
  });

  it("monthly: clamp dia 31 em fevereiro", () => {
    const first = computeFirstOccurrence(new Date(2026, 1, 15), "monthly", { dayOfMonth: 31 });
    expect(first).toEqual(new Date(2026, 1, 28));
  });

  it("monthly: vira o ano quando avança de dezembro", () => {
    const first = computeFirstOccurrence(new Date(2026, 11, 20), "monthly", { dayOfMonth: 5 });
    expect(first).toEqual(new Date(2027, 0, 5));
  });

  it("weekly/yearly/custom: devolvem start_date intocado", () => {
    const start = new Date(2026, 4, 26);
    expect(computeFirstOccurrence(start, "weekly")).toEqual(start);
    expect(computeFirstOccurrence(start, "biweekly")).toEqual(start);
    expect(computeFirstOccurrence(start, "yearly")).toEqual(start);
    expect(computeFirstOccurrence(start, "custom")).toEqual(start);
  });
});

describe("computeNextOccurrence", () => {
  it("monthly: avança um mês mantendo o dia escolhido", () => {
    const next = computeNextOccurrence(new Date(2026, 0, 15), "monthly", { dayOfMonth: 15 });
    expect(next).toEqual(new Date(2026, 1, 15));
  });

  it("monthly: clamp para o último dia do mês (dia 31 → fev 28 em 2026)", () => {
    const next = computeNextOccurrence(new Date(2026, 0, 31), "monthly", { dayOfMonth: 31 });
    expect(next).toEqual(new Date(2026, 1, 28));
  });

  it("weekly: avança até o próximo dia da semana escolhido", () => {
    // 2026-05-22 = sexta (5). Próxima terça (2) → 2026-05-26
    const next = computeNextOccurrence(new Date(2026, 4, 22), "weekly", { dayOfWeek: 2 });
    expect(next).toEqual(new Date(2026, 4, 26));
  });

  it("biweekly: avança 14 dias", () => {
    const next = computeNextOccurrence(new Date(2026, 3, 1), "biweekly");
    expect(next).toEqual(new Date(2026, 3, 15));
  });

  it("yearly: avança um ano", () => {
    const next = computeNextOccurrence(new Date(2026, 5, 1), "yearly");
    expect(next).toEqual(new Date(2027, 5, 1));
  });

  it("custom day: avança N dias", () => {
    const next = computeNextOccurrence(new Date(2026, 3, 1), "custom", { interval: 10, intervalUnit: "day" });
    expect(next).toEqual(new Date(2026, 3, 11));
  });

  it("custom week: avança N semanas", () => {
    const next = computeNextOccurrence(new Date(2026, 3, 1), "custom", { interval: 3, intervalUnit: "week" });
    expect(next).toEqual(new Date(2026, 3, 22));
  });

  it("custom month: avança N meses com clamp", () => {
    // 2026-01-31 + 1 mês → 2026-02-28 (clamp)
    const next = computeNextOccurrence(new Date(2026, 0, 31), "custom", { interval: 1, intervalUnit: "month" });
    expect(next).toEqual(new Date(2026, 1, 28));
  });
});

describe("computeNthOccurrence", () => {
  it("N=1 retorna a própria 1ª ocorrência", () => {
    const occ = computeNthOccurrence(new Date(2026, 0, 5), 1, "monthly", { dayOfMonth: 5 });
    expect(occ).toEqual(new Date(2026, 0, 5));
  });

  it("N=12 mensal a partir de jan/2026 cai em dez/2026", () => {
    const occ = computeNthOccurrence(new Date(2026, 0, 5), 12, "monthly", { dayOfMonth: 5 });
    expect(occ).toEqual(new Date(2026, 11, 5));
  });
});

describe("computeEndDateFromOccurrences", () => {
  it("mensal × 12 começando em 2026-01-05 termina em 2026-12-05", () => {
    expect(
      computeEndDateFromOccurrences({
        startDateYmd: "2026-01-05",
        frequency: "monthly",
        n: 12,
        dayOfMonth: 5,
      })
    ).toBe("2026-12-05");
  });

  it("semanal × 4 a partir de uma terça gera 4 terças consecutivas", () => {
    // 2026-05-26 = terça
    expect(
      computeEndDateFromOccurrences({
        startDateYmd: "2026-05-26",
        frequency: "weekly",
        n: 4,
        dayOfWeek: 2,
      })
    ).toBe("2026-06-16");
  });

  it("custom (a cada 3 meses × 4) cobre 9 meses adiante", () => {
    expect(
      computeEndDateFromOccurrences({
        startDateYmd: "2026-01-10",
        frequency: "custom",
        n: 4,
        interval: 3,
        intervalUnit: "month",
      })
    ).toBe("2026-10-10");
  });

  it("custom (a cada 15 dias × 3) avança 30 dias", () => {
    expect(
      computeEndDateFromOccurrences({
        startDateYmd: "2026-04-01",
        frequency: "custom",
        n: 3,
        interval: 15,
        intervalUnit: "day",
      })
    ).toBe("2026-05-01");
  });

  it("entrada inválida retorna null", () => {
    expect(computeEndDateFromOccurrences({ startDateYmd: "invalido", frequency: "monthly", n: 3 })).toBeNull();
    expect(computeEndDateFromOccurrences({ startDateYmd: "2026-01-01", frequency: "monthly", n: 0 })).toBeNull();
  });
});
