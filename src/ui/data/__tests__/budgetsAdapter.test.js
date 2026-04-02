import { describe, expect, it } from "vitest";
import {
  buildBudgetCreateChoices,
  buildCreateBudgetPayload,
  mapBudgetHistoryToUi,
  mapBudgetsResponseToUi,
  parseBudgetAmountInput,
} from "../budgetsAdapter.js";

describe("budgetsAdapter", () => {
  it("mapeia budgets da API para a estrutura usada na UI", () => {
    const result = mapBudgetsResponseToUi({
      budgets: [
        {
          id: "b1",
          organization_id: "org-1",
          tag_id: "t1",
          tag_name: "Alimentação",
          tag_color: "#2563EB",
          amount: 1200,
          period_type: "monthly",
          is_active: true,
          spent_amount: 1046,
          remaining_amount: 154,
          usage_percent: 87.16,
          status: "warning",
          created_at: "",
          updated_at: "",
          start_date: null,
          end_date: null,
        },
      ],
      summary: {
        total_budgeted: 6500,
        total_spent: 4381,
        total_remaining: 2119,
        budgets_exceeded: 1,
        budgets_warning: 1,
        budgets_ok: 3,
      },
    });

    expect(result).toEqual({
      budget: 1200,
      totalGasto: 1046,
      totalDisp: 154,
      totalPct: 87,
      alertCount: 1,
      healthLabel: "Atenção",
      cats: [
        {
          id: "b1",
          slug: "alimentacao",
          budgetId: "b1",
          tagId: "t1",
          nome: "Alimentação",
          categoryIconKey: "shopping-cart",
          emoji: "🛒",
          limite: 1200,
          gasto: 1046,
          membros: ["A", "M"],
          envelopes: [],
          navFilter: "t1",
          color: "#2563EB",
        },
      ],
    });
  });

  it("gera opções de criação apenas para tags sem orçamento", () => {
    expect(buildBudgetCreateChoices(
      [
        { id: "t1", name: "Alimentação", color: "#2563EB" },
        { id: "t2", name: "Saúde", color: "#059669" },
        { id: "t3", name: "Lazer", color: "#7C3AED" },
      ],
      [
        { tag_id: "t1", tag_name: "Alimentação" },
      ],
    )).toEqual([
      { id: "t3", nome: "Lazer", categoryIconKey: "party-popper", emoji: "🎮", color: "#7C3AED", suggestedLimit: 500 },
      { id: "t2", nome: "Saúde", categoryIconKey: "pill", emoji: "💊", color: "#059669", suggestedLimit: 400 },
    ]);
  });

  it("monta payload de criação com período mensal por padrão", () => {
    expect(buildCreateBudgetPayload("tag-1", 750)).toEqual({
      tag_id: "tag-1",
      amount: 750,
      period_type: "monthly",
    });
  });

  it("mapeia evolução mensal para histórico real de gastos", () => {
    expect(mapBudgetHistoryToUi([
      { year: 2026, month: 1, month_name: "janeiro", total_income: 8400, total_expenses: 5800, balance: 2600 },
      { year: 2026, month: 2, month_name: "fevereiro", total_income: 8400, total_expenses: 5400, balance: 3000 },
      { year: 2026, month: 3, month_name: "março", total_income: 8600, total_expenses: 4381, balance: 4219 },
    ])).toEqual([
      { m: "Jan", spent: 5800, current: false },
      { m: "Fev", spent: 5400, current: false },
      { m: "Mar", spent: 4381, current: true },
    ]);
  });

  it("faz parse de valor digitado no formato brasileiro", () => {
    expect(parseBudgetAmountInput("1.234,56")).toBe(1234.56);
    expect(parseBudgetAmountInput("750")).toBe(750);
    expect(parseBudgetAmountInput("")).toBe(0);
  });
});
