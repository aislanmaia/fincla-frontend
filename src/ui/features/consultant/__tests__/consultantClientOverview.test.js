import { describe, expect, it } from "vitest";

import {
  cashFlowRiskLabel,
  categorySegments,
  selectClientEvolutionSeries,
  diagnosisFactors,
  factorTone,
  overviewGoalsSummary,
  overviewKpis,
} from "../consultantClientOverview";

const health = {
  patrimonio_liquido: 7300, avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};
const client = { balance: "1200.00", patrimonio: "50000.00" };

describe("cashFlowRiskLabel", () => {
  it("mapeia faixas (default médio)", () => {
    expect(cashFlowRiskLabel("low")).toBe("Risco baixo");
    expect(cashFlowRiskLabel("high")).toBe("Risco alto");
    expect(cashFlowRiskLabel(undefined)).toBe("Risco médio");
  });
});

describe("overviewKpis", () => {
  it("produz os 4 KPIs (saldo/renda/poupança/comprometimento)", () => {
    const kpis = overviewKpis({ client, health });
    expect(kpis.map((k) => k.key)).toEqual(["balance", "income", "savings", "commitment"]);
    const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));
    expect(byKey.savings.value).toBe("36.0%");
    expect(byKey.commitment.value).toBe("64.0%");
    expect(byKey.income.value).toContain("7.000");
  });

  it("tom vermelho para saldo negativo", () => {
    const kpis = overviewKpis({ client: { balance: -50 }, health });
    expect(kpis[0].tone).toBe("red");
  });

  it("é seguro sem dados", () => {
    expect(overviewKpis()).toHaveLength(4);
  });
});

describe("diagnosisFactors", () => {
  it("retorna 4 fatores 0..100 com hints", () => {
    const f = diagnosisFactors(health);
    expect(f.map((x) => x.key)).toEqual(["reserve", "commitment", "savings", "consistency"]);
    f.forEach((x) => {
      expect(x.v).toBeGreaterThanOrEqual(0);
      expect(x.v).toBeLessThanOrEqual(100);
    });
  });
  it("comprometimento alto (0.9) → hint de renda comprometida e valor baixo", () => {
    const f = diagnosisFactors({ ...health, income_commitment: 0.9 });
    const commit = f.find((x) => x.key === "commitment");
    expect(commit.hint).toBe("renda muito comprometida");
    expect(commit.v).toBe(10);
  });
  it("vazio sem health", () => {
    expect(diagnosisFactors(null)).toEqual([]);
  });
});

describe("factorTone", () => {
  it("verde/âmbar/vermelho por faixa", () => {
    expect(factorTone(70)).toBe("green");
    expect(factorTone(50)).toBe("amber");
    expect(factorTone(20)).toBe("red");
  });
});

describe("categorySegments", () => {
  it("ordena desc, calcula % e usa a cor da tag", () => {
    const { segments, total } = categorySegments([
      { tag_name: "Lazer", total: 100, tag_color: "#f00" },
      { tag_name: "Moradia", total: 300, tag_color: null },
    ]);
    expect(total).toBe(400);
    expect(segments[0].label).toBe("Moradia"); // maior primeiro
    expect(segments[0].color).toBeTruthy(); // fallback de paleta
    expect(segments[1].color).toBe("#f00");
    expect(segments[0].pct).toBe(75);
  });
  it("é seguro com entrada inválida", () => {
    expect(categorySegments(null)).toEqual({ segments: [], total: 0 });
  });
});

describe("overviewGoalsSummary", () => {
  it("extrai on-track/total/progresso", () => {
    expect(overviewGoalsSummary(health)).toEqual({ onTrack: 3, total: 5, progress: 42 });
  });
});

describe("selectClientEvolutionSeries", () => {
  it("mapeia meses para o shape do CashFlowChart (mês/receita/despesa/saldo)", () => {
    const series = selectClientEvolutionSeries([
      { year: 2025, month: 1, total_income: 5000, total_expenses: 3200, balance: 1800 },
      { year: 2025, month: 2, total_income: 5200, total_expenses: 3500, balance: 1700 },
    ]);
    expect(series).toEqual([
      { month: "jan/25", income: 5000, expenses: 3200, balance: 1800 },
      { month: "fev/25", income: 5200, expenses: 3500, balance: 1700 },
    ]);
    expect(selectClientEvolutionSeries(null)).toEqual([]);
  });
});
