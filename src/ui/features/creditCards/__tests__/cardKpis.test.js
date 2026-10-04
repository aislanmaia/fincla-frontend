import { describe, expect, it } from "vitest";

import {
  computeCardKpis,
  computeInstallmentsExposure,
  computeSpendProjection,
  computeUsagePercent,
} from "../cardKpis.js";

/* Valores esperados calculados à mão com as fórmulas que viviam em
   CartoesPage/AnalyticsTab antes da extração. Se alguém "melhorar" a fórmula,
   a tela clássica e o Hub mudam juntos e este teste avisa. */
const CARD = { limite: 5000, disponivel: 3500, fechamento: 3, vencimento: 10 };

describe("heurísticas do cartão (movidas, não redesenhadas)", () => {
  it("score, velocidade e melhor dia batem com a fórmula original", () => {
    const usagePercent = computeUsagePercent(CARD); // (5000-3500)/5000 = 30%
    expect(usagePercent).toBe(30);
    const exposure = computeInstallmentsExposure([
      { vParcela: 100, total: 5, pago: 1, refundsSummary: { totalValue: 50 } },
    ]);
    expect(exposure).toMatchObject({ gross: 400, refunds: 50, net: 350, hasRefunds: true });
    const invoice = { val: 1000 };
    const projection = computeSpendProjection({ card: CARD, invoice, isCurrent: true });
    expect(projection).toBe(Math.round((1000 / 18) * 7)); // 389
    const kpis = computeCardKpis({ card: CARD, invoice, usagePercent, totalInstallments: exposure.net, projection });
    expect(kpis.monthProgressPercent).toBe(60);
    expect(kpis.spentPercent).toBe(20);
    expect(kpis.onPace).toBe(true);
    expect(kpis.healthScore).toBeCloseTo(100 - 30 - (350 / 5000) * 30, 10);
    expect(kpis.healthLabel).toBe("Regular"); // 67,9 < 70
    expect(kpis.bestPurchaseDay).toBe(4);
  });

  it("fechamento no fim do mês volta o melhor dia para 1", () => {
    const kpis = computeCardKpis({ card: { ...CARD, fechamento: 28 }, invoice: { val: 0 }, usagePercent: 0, totalInstallments: 0, projection: 0 });
    expect(kpis.bestPurchaseDay).toBe(1);
  });

  it("sem limite: score 100 se nada usado, senão 0; projeção só para fatura corrente com valor", () => {
    const base = { card: { ...CARD, limite: 0, disponivel: 0 }, invoice: { val: 0 }, totalInstallments: 0, projection: 0 };
    expect(computeCardKpis({ ...base, usagePercent: 0 }).healthScore).toBe(100);
    expect(computeCardKpis({ ...base, usagePercent: 10 }).healthScore).toBe(0);
    expect(computeSpendProjection({ card: CARD, invoice: { val: 1000 }, isCurrent: false })).toBe(0);
    expect(computeSpendProjection({ card: CARD, invoice: { val: 0 }, isCurrent: true })).toBe(0);
  });
});
