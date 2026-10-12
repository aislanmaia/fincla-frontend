import { describe, expect, it } from "vitest";
import { describeLedgerChange, weekEnd } from "../ledgerHistory.js";

const base = { filter: { cats: [], tags: [], period: "tudo", type: "todos", method: [], cardSel: [] }, kind: null, timeMode: "invoice", invoiceKeys: ["2026-10"], cardScope: "current", week: null };
const opts = { categorias: { 7: { label: "Saúde" } }, kindLabels: { installment: "Parcelas" } };

describe("describeLedgerChange", () => {
  it("categoria usa o mesmo texto de /transactions", () => {
    const after = { ...base, filter: { ...base.filter, cats: ["7"] } };
    expect(describeLedgerChange(after, base, "Desfazer", opts)).toBe("Desfazer: remover Saúde");
    expect(describeLedgerChange(base, after, "Refazer", opts)).toBe("Refazer: aplicar Saúde");
  });

  it("semana, tipo, cartão e fatura têm texto próprio", () => {
    const week = { from: "2026-10-05", to: "2026-10-11", invoiceKey: "2026-10" };
    expect(describeLedgerChange({ ...base, week }, base, "Desfazer", opts)).toBe("Desfazer: remover a semana de 05/10");
    expect(describeLedgerChange(base, { ...base, week }, "Desfazer", opts)).toBe("Desfazer: trazer de volta a semana de 05/10");
    expect(describeLedgerChange({ ...base, kind: "installment" }, base, "Desfazer", opts)).toBe("Desfazer: remover Parcelas");
    expect(describeLedgerChange({ ...base, cardScope: "all" }, base, "Desfazer", opts)).toBe("Desfazer: Cartão volta para este cartão");
    expect(describeLedgerChange({ ...base, invoiceKeys: ["2026-09"] }, base, "Desfazer", opts)).toMatch(/recorte de tempo/);
  });
});

describe("weekEnd", () => {
  it("é o sétimo dia da semana, também na virada de mês e de ano", () => {
    expect(weekEnd("2026-10-05")).toBe("2026-10-11");
    expect(weekEnd("2026-12-28")).toBe("2027-01-03");
  });
});
