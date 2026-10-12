import { describe, expect, it } from "vitest";
import { forecastEnd, groupSubtotal, remainingInstallments } from "../ledgerModel.js";

const part = (number, total, due) => ({ installment_info: [{ installment_number: number, total_installments: total, due_date: due, amount: 10 }] });

describe("modelo do ledger do cartão", () => {
  it("conta parcelas restantes e prevê o mês da última, virando o ano", () => {
    expect(remainingInstallments(part(3, 10, "2026-10-15"))).toBe(7);
    expect(forecastEnd(part(3, 10, "2026-10-15"))).toBe("mai/27");
    expect(remainingInstallments({ installment_info: [] })).toBeNull();
    expect(forecastEnd({ date: "2026-10-15" })).toBeNull();
  });
  it("última parcela não tem restantes", () => {
    expect(remainingInstallments(part(10, 10, "2026-10-15"))).toBe(0);
    expect(forecastEnd(part(10, 10, "2026-10-15"))).toBe("out/26");
  });
  it("subtotal abate estorno e recusa misturar moedas", () => {
    expect(groupSubtotal([{ type: "expense", value: 100 }, { type: "refund", value: 30 }], "BRL")).toEqual({ amount: 70, currency: "BRL" });
    expect(groupSubtotal([{ type: "expense", value: 1, value_currency: "BRL" }, { type: "expense", value: 1, value_currency: "USD" }], null)).toBeNull();
    expect(groupSubtotal([{ type: "expense", value: 1 }], null)).toBeNull();
  });
});
