import { describe, expect, it } from "vitest";
import { openInvoiceRef } from "../openInvoiceRef.js";

const d = (y, m, day) => new Date(y, m - 1, day, 12);

describe("openInvoiceRef (espelha a regra do backend)", () => {
  it("com fechamento: antes do dia fica no mês, no dia ou depois vai para o seguinte", () => {
    const card = { closing_day: 15, due_day: 10 };
    expect(openInvoiceRef(card, d(2026, 10, 14))).toEqual({ year: 2026, month: 10 });
    expect(openInvoiceRef(card, d(2026, 10, 15))).toEqual({ year: 2026, month: 11 });
    expect(openInvoiceRef(card, d(2026, 10, 20))).toEqual({ year: 2026, month: 11 });
  });

  it("vira o ano em dezembro", () => {
    expect(openInvoiceRef({ closing_day: 5, due_day: 10 }, d(2026, 12, 20))).toEqual({ year: 2027, month: 1 });
  });

  it("sem fechamento: vale o vencimento, e o dia do vencimento já conta como passado", () => {
    const card = { closing_day: null, due_day: 10 };
    expect(openInvoiceRef(card, d(2026, 10, 9))).toEqual({ year: 2026, month: 10 });
    expect(openInvoiceRef(card, d(2026, 10, 10))).toEqual({ year: 2026, month: 11 });
  });

  it("fechamento 31 em mês curto usa o último dia do mês", () => {
    const card = { closing_day: 31, due_day: 5 };
    expect(openInvoiceRef(card, d(2026, 2, 27))).toEqual({ year: 2026, month: 2 });
    expect(openInvoiceRef(card, d(2026, 2, 28))).toEqual({ year: 2026, month: 3 });
  });
});
