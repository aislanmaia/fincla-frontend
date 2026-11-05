import { describe, expect, it } from "vitest";

import { filtersToLegacyParams, matchesValueRange } from "../../features/transactions/filters/filtersToLegacyParams.js";
import { parseBudgetAmountInput } from "../../data/budgetsAdapter.js";
import { buildCreateGoalPayload, buildUpdateGoalPayload } from "../../data/goalsAdapter.js";

/** #284 nos campos que não têm tela própria testada: cada um lê na moeda dele. */
const range = (extra) => filtersToLegacyParams({ type: "todos", method: [], cats: [], period: "mes", sort: [], valueMin: "1,500", valueMax: "", ...extra });

describe("faixa de valor (filtros de Transações)", () => {
  it("lida na moeda escolhida, ou na base quando não há escolha", () => {
    expect(range({ valueCurrency: "USD" }).valueMin).toBe(1500);
    expect(range({ valueReadCurrency: "USD" }).valueMin).toBe(1500);
    // R$ (ou sem moeda): o parser de sempre — "1,500" é 1,5.
    expect(range({ valueReadCurrency: "BRL" }).valueMin).toBe(1.5);
    expect(range({}).valueMin).toBe(1.5);
  });
  it("o filtro local (modo demo) usa a mesma leitura", () => {
    expect(matchesValueRange(1200, "1,500", "", "USD")).toBe(false);
    expect(matchesValueRange(1200, "1,500", "", "BRL")).toBe(true);
  });
});

describe("orçamento", () => {
  it.each([["1,500", "USD", 1500], ["1,500", "BRL", 1.5], ["1.500", "BRL", 1500], ["1234,567", "USD", 0]])(
    "%s em %s → %s", (text, currency, value) => expect(parseBudgetAmountInput(text, currency)).toBe(value),
  );
});

describe("meta", () => {
  it("valor e aporte na moeda da meta", () => {
    const form = { nome: "Viagem", meta: "1,500", monthly_target: "250.50" };
    expect(buildCreateGoalPayload(form, "USD")).toMatchObject({ target_amount: 1500, monthly_target: 250.5 });
    expect(buildUpdateGoalPayload(form, "USD")).toMatchObject({ target_amount: 1500, monthly_target: 250.5 });
    expect(buildCreateGoalPayload({ nome: "Viagem", meta: "1.500", monthly_target: "" }, "BRL")).toMatchObject({ target_amount: 1500 });
  });
});
