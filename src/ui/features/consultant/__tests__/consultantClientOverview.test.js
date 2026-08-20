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

  it("traduz tag_name cru do seed vindo de GET /analytics/by-category (regressão #77)", () => {
    const { segments } = categorySegments([{ tag_name: "Housing", total: 300, tag_color: null }]);
    expect(segments[0].label).toBe("Moradia");
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

/**
 * `emergency_fund_months` passa a vir `null` quando não houve despesa no período
 * (fincla-api#114): a razão reserva ÷ despesa é INDEFINIDA. Antes o backend mandava
 * 99 como sentinela e a tela imprimia "99 meses". Trocar por `Number(null) || 0`
 * seria trocar um absurdo por outro — zero afirma "sem reserva nenhuma", que é o
 * oposto do que aconteceu, e rebaixaria o diagnóstico de quem só não gastou.
 */
describe("diagnosisFactors — reserva indefinida", () => {
  const base = { income_commitment: 0.4, savings_rate: 0.3, score: 70 };

  it("reserva null vira fator sem valor, não fator zerado", () => {
    const f = diagnosisFactors({ ...base, emergency_fund_months: null }).find((x) => x.key === "reserve");
    expect(f.v).toBeNull();
    expect(f.hint).toMatch(/sem despesas/i);
    expect(f.hint).not.toMatch(/abaixo do ideal/i);
  });

  it("reserva ausente do payload também é indefinida", () => {
    const f = diagnosisFactors(base).find((x) => x.key === "reserve");
    expect(f.v).toBeNull();
  });

  it("com número, continua calculando como antes", () => {
    const f = diagnosisFactors({ ...base, emergency_fund_months: 3 }).find((x) => x.key === "reserve");
    expect(f.v).toBe(50);
    expect(f.hint).toBe("saudável");
  });

  it("aceita o número serializado como string, sem chamar de indefinido", () => {
    // Dinheiro nesta API às vezes chega como `"1.9"` (fincla-api#112). Um gate por
    // tipo diria "sem despesas no período" para quem tem reserva.
    const f = diagnosisFactors({ ...base, emergency_fund_months: "3" }).find((x) => x.key === "reserve");
    expect(f.v).toBe(50);
    expect(f.hint).toBe("saudável");
  });
});
