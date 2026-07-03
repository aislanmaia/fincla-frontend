import { describe, expect, it } from "vitest";

import {
  cashFlowRiskLabel,
  formatOverviewKpi,
  selectClientOverview,
} from "../consultantClientOverview";

const health = {
  reference_month: "2026-06-01",
  ativo: 8500, passivo: 1200, patrimonio_liquido: 7300,
  avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};

describe("cashFlowRiskLabel", () => {
  it("mapeia as faixas em PT-BR (default médio)", () => {
    expect(cashFlowRiskLabel("low")).toBe("Risco baixo");
    expect(cashFlowRiskLabel("high")).toBe("Risco alto");
    expect(cashFlowRiskLabel("medium")).toBe("Risco médio");
    expect(cashFlowRiskLabel(undefined)).toBe("Risco médio");
  });
});

describe("selectClientOverview", () => {
  it("retorna null sem dados", () => {
    expect(selectClientOverview(null)).toBeNull();
  });

  it("extrai score arredondado e risco", () => {
    const vm = selectClientOverview({ ...health, score: 71.6 });
    expect(vm.score).toBe(72);
    expect(vm.risk).toEqual({ key: "low", label: "Risco baixo" });
  });

  it("converte razões 0..1 em % (commitment/savings) e mantém goal_progress 0..100", () => {
    const vm = selectClientOverview(health);
    const byKey = Object.fromEntries(vm.kpis.map((k) => [k.key, k]));
    expect(byKey.commitment.value).toBeCloseTo(64);
    expect(byKey.savings.value).toBeCloseTo(36);
    expect(vm.goals).toEqual({ onTrack: 3, total: 5, progress: 42 });
  });

  it("marca bad: patrimônio/sobra negativos, comprometimento >80%, reserva <1", () => {
    const vm = selectClientOverview({
      ...health,
      patrimonio_liquido: -100, avg_surplus: -50,
      income_commitment: 0.9, savings_rate: -0.1, emergency_fund_months: 0.5,
    });
    const byKey = Object.fromEntries(vm.kpis.map((k) => [k.key, k]));
    expect(byKey.net_worth.bad).toBe(true);
    expect(byKey.avg_surplus.bad).toBe(true);
    expect(byKey.commitment.bad).toBe(true);
    expect(byKey.savings.bad).toBe(true);
    expect(byKey.reserve.bad).toBe(true);
  });

  it("não marca bad em números saudáveis", () => {
    const vm = selectClientOverview(health);
    const byKey = Object.fromEntries(vm.kpis.map((k) => [k.key, k]));
    expect(byKey.net_worth.bad).toBe(false);
    expect(byKey.commitment.bad).toBe(false); // 64% ≤ 80
    expect(byKey.reserve.bad).toBe(false); // 1.9 ≥ 1
  });
});

describe("formatOverviewKpi", () => {
  it("formata por kind", () => {
    expect(formatOverviewKpi({ kind: "pct", value: 64 })).toBe("64.0%");
    expect(formatOverviewKpi({ kind: "months", value: 1 })).toBe("1 mês");
    expect(formatOverviewKpi({ kind: "months", value: 1.9 })).toBe("1,9 meses");
    expect(formatOverviewKpi({ kind: "money", value: 7300 })).toContain("7.300");
  });
});
