// "Faturas conciliadas" do cartão: as contagens de cada linha, no tempo verbal do estado. Os
// "Adicionar" contam compras novas E encargos, tarifas e estornos (fincla-api#558): "lançamentos".
import { describe, expect, it } from "vitest";

import { invoiceCountsLabel } from "../ReconciledInvoices.jsx";

const summary = { total: 20, to_pair: 0, to_create: 13, summed_charges: 0, already_reconciled: 0, ignored: 0, unanswered: 0 };

describe("invoiceCountsLabel: os adicionados são lançamentos, não só compras novas", () => {
  it.each([
    ["draft", "20 lançamentos · 13 lançamentos a adicionar"],
    ["concluded", "20 lançamentos · 13 lançamentos adicionados"],
    ["undone", "20 lançamentos · 13 lançamentos adicionados e desfeitos"],
  ])("%s", (status, text) => {
    expect(invoiceCountsLabel({ status, summary })).toBe(text);
  });

  it("um só, no singular", () => {
    expect(invoiceCountsLabel({ status: "concluded", summary: { ...summary, to_create: 1 } })).toBe("20 lançamentos · 1 lançamento adicionado");
  });
});
