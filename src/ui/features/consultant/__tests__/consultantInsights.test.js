import { describe, expect, it } from "vitest";

import {
  buildConsolidatedCsv,
  selectCashFlowSeries,
  selectExpenseRows,
  selectGoalsProgressRows,
  selectIncomeCommitmentSeries,
  selectMovers,
} from "../consultantInsights.js";

describe("selectExpenseRows", () => {
  it("ordena por gasto desc, corta em N, atribui cor e calcula max", () => {
    const { rows, max } = selectExpenseRows(
      [
        { name: "Alimentação", total: 300, percentage: 30 },
        { name: "Transporte", total: 700, percentage: 70 },
      ],
    );
    expect(rows.map((r) => r.label)).toEqual(["Transporte", "Alimentação"]);
    expect(rows[0].color).toBeTruthy();
    expect(max).toBe(700);
  });
  it("tolera entrada ausente", () => {
    expect(selectExpenseRows(null)).toEqual({ rows: [], max: 0 });
  });
});

describe("selectMovers", () => {
  const clients = [
    { organization_id: "a", trend: "up" },
    { organization_id: "b", trend: "down" },
    { organization_id: "c", trend: "flat" },
    { organization_id: "d", trend: "up" },
  ];
  it("separa evoluções (up) de quedas (down)", () => {
    const { gainers, decliners } = selectMovers(clients);
    expect(gainers.map((c) => c.organization_id)).toEqual(["a", "d"]);
    expect(decliners.map((c) => c.organization_id)).toEqual(["b"]);
  });
  it("respeita o limite e tolera entrada ausente", () => {
    expect(selectMovers(clients, 1).gainers).toHaveLength(1);
    expect(selectMovers(undefined)).toEqual({ gainers: [], decliners: [] });
  });
});

describe("selectCashFlowSeries", () => {
  it("mapeia receita/despesa/saldo com rótulo curto de mês e corta nos últimos N", () => {
    const monthly = [
      { month: "2025-01", month_number: 1, year: 2025, total_income: 50000, total_expenses: 32000, balance: 18000 },
      { month: "2025-02", month_number: 2, year: 2025, total_income: 52000, total_expenses: 35000, balance: 17000 },
    ];
    const series = selectCashFlowSeries(monthly);
    expect(series).toEqual([
      { month: "jan/25", income: 50000, expenses: 32000, balance: 18000 },
      { month: "fev/25", income: 52000, expenses: 35000, balance: 17000 },
    ]);
    expect(selectCashFlowSeries(monthly, 1)).toHaveLength(1);
    expect(selectCashFlowSeries(null)).toEqual([]);
  });
});

describe("selectIncomeCommitmentSeries", () => {
  it("mapeia o percentual mensal (1 casa) com rótulo de mês", () => {
    const series = selectIncomeCommitmentSeries([
      { month_number: 3, year: 2025, income_commitment_percent: 35.55 },
    ]);
    expect(series).toEqual([{ month: "mar/25", pct: 35.6 }]);
    expect(selectIncomeCommitmentSeries(undefined)).toEqual([]);
  });
});

describe("selectGoalsProgressRows", () => {
  it("ordena por progresso desc, humaniza o tipo e mantém a contagem", () => {
    const rows = selectGoalsProgressRows([
      { goal_name: "viagem", avg_progress: 42, count: 3 },
      { goal_name: "reserva_emergencia", avg_progress: 65.5, count: 5 },
    ]);
    expect(rows[0]).toMatchObject({ label: "Reserva de emergência", value: 66, count: 5 });
    expect(rows[1]).toMatchObject({ label: "Viagem", value: 42, count: 3 });
    expect(rows[0].color).toBeTruthy();
    expect(selectGoalsProgressRows(null)).toEqual([]);
  });
});

describe("buildConsolidatedCsv", () => {
  it("gera CSV pt-BR (;) com as métricas do consolidado", () => {
    const csv = buildConsolidatedCsv({
      total_income: 100, total_expenses: 60, balance: 40,
      total_transactions: 12, organizations_count: 3,
      period_start: "2025-01-01", period_end: "2025-03-31",
    });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Métrica;Valor");
    expect(lines).toContain("Saldo;40");
    expect(lines).toContain("Organizações;3");
    expect(lines).toContain("Período fim;2025-03-31");
  });
  it("tolera entrada ausente (zeros/strings vazias)", () => {
    const csv = buildConsolidatedCsv(null);
    expect(csv).toContain("Receita total;0");
    expect(csv).toContain("Período início;");
  });
});
