import { describe, expect, it } from "vitest";

import { EXPENSE_BASIS_NOTE, pdfCohortLine, pdfDate, pdfDateRange, pdfInsightLine } from "../portfolioExpensePdfText";

describe("portfolioExpensePdfText", () => {
  it("states that unpaid but already recorded expenses are counted", () => {
    expect(EXPENSE_BASIS_NOTE).toBe("Inclui despesas ainda não pagas mas já lançadas");
  });

  it("formats ISO dates as dd/mm/aaaa, like the screen", () => {
    expect(pdfDate("2026-06-01")).toBe("01/06/2026");
    expect(pdfDate(undefined)).toBe("—");
    expect(pdfDateRange("2026-06-01", "2026-11-30")).toBe("01/06/2026 a 30/11/2026");
  });

  it("separates the insight title from its description with a full stop", () => {
    const line = pdfInsightLine(0, {
      title: "Alimentação e Transporte somam 95,4% dos gastos da coorte comparável",
      description: "Alimentação aparece em 46 clientes.",
      follow_up: "Quais clientes concentram os maiores gastos?",
    });
    expect(line).toBe("1. Alimentação e Transporte somam 95,4% dos gastos da coorte comparável. Alimentação aparece em 46 clientes. Próxima investigação: Quais clientes concentram os maiores gastos?");
  });

  it("does not double an existing full stop or question mark", () => {
    expect(pdfInsightLine(1, { title: "Título.", description: "Texto.", follow_up: "Pergunta?" })).toBe("2. Título. Texto. Próxima investigação: Pergunta?");
  });

  it("writes conversions without arrow glyphs that the PDF font cannot draw", () => {
    const line = pdfCohortLine({
      client_count: 16, base_currency: "EUR", reading_currency: "BRL",
      original_total: { amount: "1420.00" }, converted_total: { amount: "8520.00" },
    });
    expect(line.replace(/\u00a0/g, " ")).toBe("16 clientes · EUR para BRL: € 1.420,00 convertidos em R$ 8.520,00");
    expect(line).not.toMatch(/[→’']/);
  });
});
