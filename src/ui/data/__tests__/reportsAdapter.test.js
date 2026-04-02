import { describe, expect, it } from "vitest";
import {
  buildCategoryComposition,
  buildDriftData,
  buildReportKpis,
  buildVelocityDailyFromTransactions,
  buildWaterfallRowsFromCategories,
  mapMonthlyEvolutionToUi,
  resolveReportMonths,
  velocityPressureVsIdealAtDay,
} from "../reportsAdapter.js";

describe("reportsAdapter", () => {
  it("KPIs do strip usam último mês; period* acumula o intervalo", () => {
    const rows = mapMonthlyEvolutionToUi([
      { year: 2026, month: 2, total_income: 1000, total_expenses: 400, balance: 600 },
      { year: 2026, month: 3, total_income: 2000, total_expenses: 500, balance: 1500 },
    ]);
    const k = buildReportKpis(rows);
    expect(k.totalR).toBe(2000);
    expect(k.totalG).toBe(500);
    expect(k.saldo).toBe(1500);
    expect(k.periodTotalR).toBe(3000);
    expect(k.periodTotalG).toBe(900);
    expect(k.periodSaldo).toBe(2100);
  });

  it("resolve quantidade de meses a partir do periodo da UI", () => {
    expect(resolveReportMonths("3m")).toBe(3);
    expect(resolveReportMonths("6m")).toBe(6);
    expect(resolveReportMonths("12m")).toBe(12);
    expect(resolveReportMonths("qualquer")).toBe(6);
  });

  it("mapeia monthly evolution para o formato usado nos gráficos da UI", () => {
    expect(mapMonthlyEvolutionToUi([
      { year: 2026, month: 2, month_name: "fevereiro", total_income: 8400, total_expenses: 5400, balance: 3000 },
      { year: 2026, month: 3, month_name: "março", total_income: 8600, total_expenses: 4381, balance: 4219 },
    ])).toEqual([
      { mes: "Fev'26", receita: 8400, gasto: 5400, saldo: 3000, score: 36, current: false },
      { mes: "Mar'26", receita: 8600, gasto: 4381, saldo: 4219, score: 49, current: true },
    ]);
  });

  it("gera dados de composição ordenados por valor", () => {
    expect(buildCategoryComposition([
      { tag_id: "1", tag_name: "Lazer", total: 388, percentage: 10, transaction_count: 3, tag_color: "#7C3AED" },
      { tag_id: "2", tag_name: "Alimentação", total: 1046, percentage: 30, transaction_count: 8, tag_color: "#2563EB" },
    ])).toEqual([
      { name: "Alimentação", value: 1046, color: "#2563EB" },
      { name: "Lazer", value: 388, color: "#7C3AED" },
    ]);
  });

  it("traduz nomes canônicos em inglês da API para PT na composição", () => {
    expect(buildCategoryComposition([
      {
        tag_id: "a",
        tag_name: "Food & Groceries",
        tag_icon_key: "shopping-cart",
        total: 500,
        percentage: 50,
        transaction_count: 5,
        tag_color: "#059669",
      },
      {
        tag_id: "b",
        tag_name: "Transport",
        tag_icon_key: "car",
        total: 200,
        percentage: 20,
        transaction_count: 2,
        tag_color: "#2563EB",
      },
    ])).toEqual([
      { name: "Alimentação", value: 500, color: "#059669" },
      { name: "Transporte", value: 200, color: "#2563EB" },
    ]);
  });

  it("faz o pivot do spending rhythm para a estrutura empilhada da UI", () => {
    expect(buildDriftData({
      months: ["fev/2026", "mar/2026"],
      monthly_totals: [1510, 1434],
      categories: [
        { tag_id: "1", tag_name: "Alimentação", monthly_totals: [970, 1046], average: 1008, trend: "up", tag_color: "#2563EB" },
        { tag_id: "2", tag_name: "Lazer", monthly_totals: [540, 388], average: 464, trend: "down", tag_color: "#7C3AED" },
      ],
    })).toEqual({
      driftData: [
        { mes: "Fev'26", "Alimentação": 970, Lazer: 540 },
        { mes: "Mar'26", "Alimentação": 1046, Lazer: 388 },
      ],
      driftColors: {
        "Alimentação": "#2563EB",
        Lazer: "#7C3AED",
      },
    });
  });

  it("traduz chaves de série do drift quando a API manda nomes em inglês", () => {
    expect(buildDriftData({
      months: ["fev/2026"],
      monthly_totals: [100],
      categories: [
        {
          tag_id: "1",
          tag_name: "Health",
          tag_icon_key: "pill",
          monthly_totals: [100],
          average: 100,
          trend: "stable",
          tag_color: "#DC2626",
        },
      ],
    })).toEqual({
      driftData: [{ mes: "Fev'26", "Saúde": 100 }],
      driftColors: { "Saúde": "#DC2626" },
    });
  });

  it("monta linhas da cascata a partir de receita e categorias da API", () => {
    expect(
      buildWaterfallRowsFromCategories(8600, [
        { tag_name: "Moradia", total: 1500, tag_color: "#111" },
        { tag_name: "Alimentação", total: 1046, tag_color: "#222" },
      ]),
    ).toEqual([
      { nome: "Receita", val: 8600, tipo: "receita" },
      { nome: "Moradia", val: -1500, tipo: "despesa" },
      { nome: "Alimentação", val: -1046, tipo: "despesa" },
      { nome: "Saldo", val: 6054, tipo: "saldo" },
    ]);
  });

  it("gera série diária acumulada para o gráfico de velocidade", () => {
    const series = buildVelocityDailyFromTransactions(
      [
        { type: "expense", date: "2026-03-05", value: 100 },
        { type: "expense", date: "2026-03-05", value: 50 },
        { type: "expense", date: "2026-03-10", value: 200 },
      ],
      "2026-03-01",
      "2026-03-31",
      3100,
    );
    expect(series).toHaveLength(31);
    expect(series[4].dia).toBe("D5");
    expect(series[4].real).toBe(150);
    expect(series[9].real).toBe(350);
    expect(series[9].ideal).toBeCloseTo((3100 / 31) * 10, 0);
  });

  it("velocityPressureVsIdealAtDay calcula % vs ritmo linear", () => {
    const daily = buildVelocityDailyFromTransactions(
      [{ type: "expense", date: "2026-03-01", value: 200 }],
      "2026-03-01",
      "2026-03-31",
      310,
    );
    expect(velocityPressureVsIdealAtDay(daily)).toBe(300);
  });
});
