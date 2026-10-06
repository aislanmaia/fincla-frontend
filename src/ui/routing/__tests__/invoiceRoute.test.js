import { describe, expect, it } from "vitest";

import { invoiceDashboardPath, isValidInvoiceParams } from "../invoiceRoute.js";
import { parseFinclaRootSearch } from "../finclaRootSearchSchema.js";
import { mergeNavSearch } from "../searchContract.js";

describe("rota do dashboard da fatura", () => {
  const cardId = "00000000-0000-4000-8000-000000000007";
  it("monta /cards/<cardId>/invoices/<year>/<month>", () => {
    expect(invoiceDashboardPath(cardId, 2026, 10)).toBe(`/cards/${cardId}/invoices/2026/10`);
  });

  it("só aceita ano e mês inteiros e plausíveis", () => {
    expect(isValidInvoiceParams({ cardId, year: "2026", month: "10" })).toBe(true);
    expect(isValidInvoiceParams({ cardId, year: "2026", month: "13" })).toBe(false);
    expect(isValidInvoiceParams({ cardId, year: "abc", month: "1" })).toBe(false);
    expect(isValidInvoiceParams({ cardId: "7", year: "2026", month: "10" })).toBe(false);
    expect(isValidInvoiceParams({ cardId: "", year: "2026", month: "1" })).toBe(false);
  });
});

describe("?view=new", () => {
  it("aceita só o identificador público do cartão na URL", () => {
    const publicId = "00000000-0000-4000-8000-000000000007";
    expect(parseFinclaRootSearch({ view: "new", card: publicId }).card).toBe(publicId);
    expect(parseFinclaRootSearch({ view: "new", card: "7" }).card).toBeUndefined();
  });

  it("sobrevive ao schema só com o valor new", () => {
    expect(parseFinclaRootSearch({ view: "new" }).view).toBe("new");
    expect(parseFinclaRootSearch({ view: "classic" }).view).toBeUndefined();
    expect(parseFinclaRootSearch({ view: "outro" }).view).toBeUndefined();
  });

  it("não vaza para outras telas ao navegar", () => {
    expect(mergeNavSearch({ view: "new" }, "dashboard").view).toBeUndefined();
  });
});
