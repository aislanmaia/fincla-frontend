import { describe, expect, it } from "vitest";
import {
  pickCommittedExpenseForDashboard,
  pickProjectedRecurringIncomeForDashboard,
} from "../dashboardRecurringKpi.js";

describe("dashboardRecurringKpi", () => {
  it("usa recurring_in_period.total_expense quando presente", () => {
    expect(
      pickCommittedExpenseForDashboard(
        {
          recurring_in_period: {
            total_expense: 320,
            total_income: 100,
            period: { start_date: "2025-01-01", end_date: "2025-01-31" },
          },
        },
        { total_monthly_expense: 9999 },
      ),
    ).toBe(320);
  });

  it("faz fallback para total_monthly_expense quando recurring_in_period ausente", () => {
    expect(
      pickCommittedExpenseForDashboard(
        { total_income: 0, total_expenses: 0 },
        { total_monthly_expense: 2100 },
      ),
    ).toBe(2100);
  });

  it("retorna 0 quando não há dados", () => {
    expect(pickCommittedExpenseForDashboard(null, null)).toBe(0);
  });

  it("não retorna negativo para total_expense negativo na API", () => {
    expect(
      pickCommittedExpenseForDashboard(
        {
          recurring_in_period: {
            total_expense: -10,
            total_income: 0,
            period: { start_date: "2025-01-01", end_date: "2025-01-05" },
          },
        },
        null,
      ),
    ).toBe(0);
  });

  it("usa recurring_in_period.total_income para projeção de receita", () => {
    expect(
      pickProjectedRecurringIncomeForDashboard(
        {
          recurring_in_period: {
            total_expense: 0,
            total_income: 5000,
            period: { start_date: "2025-01-01", end_date: "2025-01-31" },
          },
        },
        { total_monthly_income: 999 },
      ),
    ).toBe(5000);
  });

  it("faz fallback para total_monthly_income quando recurring_in_period ausente", () => {
    expect(
      pickProjectedRecurringIncomeForDashboard(null, { total_monthly_income: 8400 }),
    ).toBe(8400);
  });

  describe("mudança de período (cada summary traz seu recurring_in_period)", () => {
    const series = { total_monthly_expense: 100, total_monthly_income: 5000 };

    it("Comprometido reflete o trimestre (ex.: 3× mensal) e não o valor mensal da série", () => {
      const summaryQ2 = {
        recurring_in_period: {
          total_expense: 300,
          total_income: 0,
          period: { start_date: "2026-04-01", end_date: "2026-06-30" },
        },
      };
      expect(pickCommittedExpenseForDashboard(summaryQ2, series)).toBe(300);
    });

    it("ao trocar para um mês dentro do trimestre, usa o total daquele intervalo", () => {
      const summaryApr = {
        recurring_in_period: {
          total_expense: 100,
          total_income: 0,
          period: { start_date: "2026-04-01", end_date: "2026-04-30" },
        },
      };
      expect(pickCommittedExpenseForDashboard(summaryApr, series)).toBe(100);
    });

    it("projeção de receita segue o mesmo padrão ao mudar o período", () => {
      const summaryMay = {
        recurring_in_period: {
          total_expense: 0,
          total_income: 8000,
          period: { start_date: "2026-05-01", end_date: "2026-05-31" },
        },
      };
      expect(pickProjectedRecurringIncomeForDashboard(summaryMay, series)).toBe(8000);
    });
  });
});
