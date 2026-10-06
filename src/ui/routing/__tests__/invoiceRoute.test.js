import { describe, expect, it } from "vitest";

import { invoiceDashboardPath, isValidInvoiceParams } from "../invoiceRoute.js";
import { parseFinclaRootSearch } from "../finclaRootSearchSchema.js";
import { mergeNavSearch } from "../searchContract.js";

describe("rota do dashboard da fatura", () => {
  it("monta /cards/<cardId>/invoices/<year>/<month>", () => {
    expect(invoiceDashboardPath(7, 2026, 10)).toBe("/cards/7/invoices/2026/10");
  });

  it("só aceita ano e mês inteiros e plausíveis", () => {
    expect(isValidInvoiceParams({ cardId: "7", year: "2026", month: "10" })).toBe(true);
    expect(isValidInvoiceParams({ cardId: "7", year: "2026", month: "13" })).toBe(false);
    expect(isValidInvoiceParams({ cardId: "7", year: "abc", month: "1" })).toBe(false);
    expect(isValidInvoiceParams({ cardId: "", year: "2026", month: "1" })).toBe(false);
  });
});

describe("?view=new", () => {
  it("sobrevive ao schema só com o valor new", () => {
    expect(parseFinclaRootSearch({ view: "new" }).view).toBe("new");
    expect(parseFinclaRootSearch({ view: "classic" }).view).toBeUndefined();
    expect(parseFinclaRootSearch({ view: "outro" }).view).toBeUndefined();
  });

  it("não vaza para outras telas ao navegar", () => {
    expect(mergeNavSearch({ view: "new" }, "dashboard").view).toBeUndefined();
  });
});
