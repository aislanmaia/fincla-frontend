import { describe, expect, it } from "vitest";
import { defaultInvoiceKeys, invoiceChipLabel, invoiceIdsForQuery, invoiceOptions, periodChipLabel } from "../invoiceScope.js";

const NOW = new Date(2026, 9, 11);
const history = {
  monthly_data: [
    { year: 2026, month: 8, invoice_id: 38, status: "paid", total_amount: 100, items_count: 3 },
    { year: 2026, month: 9, invoice_id: 39, status: "closed", total_amount: 200, items_count: 4 },
    { year: 2026, month: 10, invoice_id: 40, status: "open", total_amount: 300, items_count: 5 },
    { year: 2026, month: 7, invoice_id: null, status: "open", total_amount: 0, items_count: 0 },
    { year: 2025, month: 12, invoice_id: 30, status: "paid", total_amount: 50, items_count: 1 },
    { year: 2027, month: 1, invoice_id: 50, status: "open", total_amount: 10, items_count: 1 },
  ],
};

describe("invoice scope", () => {
  const options = invoiceOptions(history);

  it("lists invoices newest first and keeps months without an invoice unselectable", () => {
    expect(options.map((option) => option.key)).toEqual(["2027-01", "2026-10", "2026-09", "2026-08", "2026-07", "2025-12"]);
    expect(options.find((option) => option.key === "2026-07").invoiceId).toBeNull();
  });

  it("opens on the most recent open invoice", () => {
    expect(defaultInvoiceKeys(options)).toEqual(["2027-01"]);
    expect(defaultInvoiceKeys(options.filter((option) => option.status !== "open"))).toEqual(["2026-09"]);
    expect(defaultInvoiceKeys([])).toEqual([]);
  });

  it("shows the year only for invoices outside the current year", () => {
    expect(invoiceChipLabel(options, ["2026-08", "2026-09"], NOW)).toBe("Faturas: Ago, Set");
    expect(invoiceChipLabel(options, ["2026-09"], NOW)).toBe("Fatura: Set");
    expect(invoiceChipLabel(options, ["2026-08", "2026-09", "2027-01"], NOW)).toBe("Faturas: Ago, Set, Jan/2027");
    expect(invoiceChipLabel(options, ["2025-12"], NOW)).toBe("Fatura: Dez/2025");
  });

  it("summarises many invoices and names the empty selection", () => {
    expect(invoiceChipLabel(options, ["2026-08", "2026-09", "2026-10", "2025-12"], NOW)).toBe("4 faturas");
    expect(invoiceChipLabel(options, [], NOW)).toBe("Nenhuma fatura");
    expect(invoiceChipLabel(options, ["2026-07"], NOW)).toBe("Nenhuma fatura");
  });

  it("sends only real invoice ids, and only in invoice mode", () => {
    expect(invoiceIdsForQuery("invoice", options, ["2026-09", "2026-07", "2026-08"])).toEqual([39, 38]);
    expect(invoiceIdsForQuery("invoice", options, [])).toEqual([]);
    expect(invoiceIdsForQuery("period", options, ["2026-09"])).toBeUndefined();
  });

  it("labels periods and adds the year to ranges outside the current year", () => {
    expect(periodChipLabel({ period: "tudo" }, NOW)).toBe("Todo o período");
    expect(periodChipLabel({ period: "mes" }, NOW)).toBe("Período: Este mês");
    expect(periodChipLabel({ period: "custom", customFrom: "2026-03-01", customTo: "2026-04-10", customLabel: "1 mar – 10 abr" }, NOW)).toBe("Período: 1 mar – 10 abr");
    expect(periodChipLabel({ period: "custom", customFrom: "2025-03-01", customTo: "2025-04-10", customLabel: "x" }, NOW)).toBe("Período: 1 mar 2025 – 10 abr 2025");
  });
});
