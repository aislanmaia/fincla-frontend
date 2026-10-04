import { describe, expect, it } from "vitest";

import {
  computeCardKpis,
  computeCycle,
  computeInstallmentsExposure,
  computeSpendProjection,
  computeUsagePercent,
} from "../cardKpis.js";

const d = (y, m, day) => new Date(y, m - 1, day, 15, 0, 0);

describe("ciclo real do cartão (computeCycle)", () => {
  it("04/10 com fechamento dia 15: ciclo de 15/09 a 15/10 (30 dias), 19 decorridos", () => {
    expect(computeCycle({ closingDay: 15, today: d(2026, 10, 4) })).toMatchObject({ elapsedDays: 19, cycleLength: 30 });
  });

  it("a duração é a real: ciclo de 15/01 a 15/02 tem 31 dias, de 15/02 a 15/03 tem 28", () => {
    expect(computeCycle({ closingDay: 15, today: d(2026, 2, 10) })).toMatchObject({ elapsedDays: 26, cycleLength: 31 });
    expect(computeCycle({ closingDay: 15, today: d(2026, 3, 1) })).toMatchObject({ elapsedDays: 14, cycleLength: 28 });
  });

  it("fevereiro bissexto tem 29 dias no ciclo", () => {
    expect(computeCycle({ closingDay: 15, today: d(2028, 3, 1) })).toMatchObject({ elapsedDays: 15, cycleLength: 29 });
  });

  it("fechamento dia 31 em mês de 30 dias fecha no dia 30", () => {
    // fechamentos: 30/04 e 31/05 -> ciclo de 31 dias; hoje 10/05 = 10 dias depois de 30/04
    expect(computeCycle({ closingDay: 31, today: d(2026, 5, 10) })).toMatchObject({ elapsedDays: 10, cycleLength: 31 });
  });

  it("virada de ano: hoje 05/01 com fechamento dia 20 olha o fechamento de dezembro", () => {
    expect(computeCycle({ closingDay: 20, today: d(2026, 1, 5) })).toMatchObject({ elapsedDays: 16, cycleLength: 31 });
  });

  it("depois do fechamento do mês, o ciclo corrente vai até o fechamento do mês seguinte", () => {
    expect(computeCycle({ closingDay: 3, today: d(2026, 10, 4) })).toMatchObject({ elapsedDays: 1, cycleLength: 31 });
  });

  it("no próprio dia do fechamento a fatura ainda está aberta (último dia do ciclo)", () => {
    expect(computeCycle({ closingDay: 15, today: d(2026, 10, 15) })).toMatchObject({ elapsedDays: 30, cycleLength: 30 });
  });
});

describe("projeção de fechamento", () => {
  const card = { limite: 5000, disponivel: 3500, fechamento: 15, vencimento: 10 };

  it("gasto até agora / dias decorridos x duração real do ciclo", () => {
    const projection = computeSpendProjection({ card, invoice: { val: 1900 }, isCurrent: true, today: d(2026, 10, 4) });
    expect(projection).toBe(3000); // 1900 / 19 * 30
  });

  it("primeiro dia do ciclo: poucos dados, sem número (nunca extrapola de 1 dia)", () => {
    expect(computeSpendProjection({ card: { ...card, fechamento: 3 }, invoice: { val: 900 }, isCurrent: true, today: d(2026, 10, 4) })).toBeNull();
  });

  it("fatura aberta sem lançamentos: sem projeção, não 0", () => {
    expect(computeSpendProjection({ card, invoice: { val: 0 }, isCurrent: true, today: d(2026, 10, 4) })).toBeNull();
    expect(computeSpendProjection({ card, invoice: { val: null }, isCurrent: true, today: d(2026, 10, 4) })).toBeNull();
  });

  it("fatura que não é a atual não tem projeção", () => {
    expect(computeSpendProjection({ card, invoice: { val: 1900 }, isCurrent: false, today: d(2026, 10, 4) })).toBeNull();
  });

  it("cartão sem dia de fechamento usa o fechamento efetivo da tela", () => {
    const sem = { ...card, fechamento: 1, closingDayEffective: 10 };
    const cycle = computeCycle({ closingDay: 10, today: d(2026, 10, 4) });
    expect(computeSpendProjection({ card: sem, invoice: { val: 1000 }, isCurrent: true, today: d(2026, 10, 4) }))
      .toBe(Math.round((1000 / cycle.elapsedDays) * cycle.cycleLength));
  });
});

describe("heurísticas do cartão", () => {
  const card = { limite: 5000, disponivel: 3500, fechamento: 15, vencimento: 10 };

  it("progresso do ciclo e ritmo usam a data de hoje, sem constante", () => {
    const today = d(2026, 10, 4);
    const invoice = { val: 1000 };
    const usagePercent = computeUsagePercent(card);
    expect(usagePercent).toBe(30);
    const exposure = computeInstallmentsExposure([{ vParcela: 100, total: 5, pago: 1, refundsSummary: { totalValue: 50 } }]);
    expect(exposure).toMatchObject({ gross: 400, refunds: 50, net: 350, hasRefunds: true });
    const projection = computeSpendProjection({ card, invoice, isCurrent: true, today });
    const kpis = computeCardKpis({ card, invoice, usagePercent, totalInstallments: exposure.net, projection, today });
    expect(kpis.cycleProgressPercent).toBe(63); // 19 / 30
    expect(kpis.spentPercent).toBe(20);
    expect(kpis.onPace).toBe(true);
    expect(kpis.hasPaceData).toBe(true);
    expect(kpis.projection).toBe(1579); // 1000 / 19 * 30
    expect(kpis.healthScore).toBeCloseTo(100 - 30 - (350 / 5000) * 30, 10);
    expect(kpis.healthLabel).toBe("Regular");
    expect(kpis.bestPurchaseDay).toBe(16);
  });

  it("gasto acima do progresso do ciclo é ritmo acelerado", () => {
    const today = d(2026, 10, 4);
    const kpis = computeCardKpis({ card, invoice: { val: 4000 }, usagePercent: 30, totalInstallments: 0, projection: 6000, today });
    expect(kpis.spentPercent).toBe(80);
    expect(kpis.onPace).toBe(false);
  });

  it("primeiro dia do ciclo: sem veredito de ritmo", () => {
    const kpis = computeCardKpis({ card: { ...card, fechamento: 3 }, invoice: { val: 100 }, usagePercent: 0, totalInstallments: 0, projection: null, today: d(2026, 10, 4) });
    expect(kpis.hasPaceData).toBe(false);
    expect(kpis.onPace).toBeNull();
    expect(kpis.projection).toBeNull();
  });

  it("fatura sem lançamentos: sem veredito de ritmo e sem projeção", () => {
    const kpis = computeCardKpis({ card, invoice: { val: 0 }, usagePercent: 0, totalInstallments: 0, projection: null, today: d(2026, 10, 4) });
    expect(kpis.hasPaceData).toBe(false);
    expect(kpis.projection).toBeNull();
  });

  it("fechamento no fim do mês volta o melhor dia para 1", () => {
    const kpis = computeCardKpis({ card: { ...card, fechamento: 28 }, invoice: { val: 0 }, usagePercent: 0, totalInstallments: 0, projection: null, today: d(2026, 10, 4) });
    expect(kpis.bestPurchaseDay).toBe(1);
  });

  it("sem limite: score 100 se nada usado, senão 0", () => {
    const base = { card: { ...card, limite: 0, disponivel: 0 }, invoice: { val: 0 }, totalInstallments: 0, projection: null, today: d(2026, 10, 4) };
    expect(computeCardKpis({ ...base, usagePercent: 0 }).healthScore).toBe(100);
    expect(computeCardKpis({ ...base, usagePercent: 10 }).healthScore).toBe(0);
  });

  it("exposição de parcelas desconhecida (null): score não afirmado, ritmo e melhor dia seguem", () => {
    const kpis = computeCardKpis({ card, invoice: { val: 1000 }, usagePercent: 30, totalInstallments: null, projection: 1579, today: d(2026, 10, 4) });
    expect(kpis.healthScore).toBeNull();
    expect(kpis.healthLabel).toBe("Sem dados ainda");
    expect(kpis.bestPurchaseDay).toBe(16);
    expect(kpis.hasPaceData).toBe(true);
  });
});
