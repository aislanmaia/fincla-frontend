import { describe, expect, it } from "vitest";
import { buildCalendarEvents, monthMatrix, monthSummary } from "../calendarModel.js";

describe("calendarModel", () => {
  it("monthMatrix cobre o mês em semanas de 7", () => {
    const weeks = monthMatrix(2026, 6); // junho/2026
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const days = weeks.flat().filter(Boolean);
    expect(days.length).toBe(30);
    expect(days[0].ymd).toBe("2026-06-01");
    expect(days[29].ymd).toBe("2026-06-30");
  });

  it("agrupa eventos por dia; parcelas de cartão por due_date; ignora fora do mês", () => {
    const txs = [
      { type: "income", description: "Salário", value: 5000, status: "paid", paid_at: "2026-06-05T10:00", date: "2026-06-05T10:00" },
      { type: "expense", description: "Aluguel", value: 1800, status: "confirmed", date: "2026-06-10T00:00" },
      { type: "expense", description: "Cartão", value: 2340, installment_info: [{ installment_number: 1, total_installments: 1, due_date: "2026-06-12", amount: 2340 }] },
      { type: "expense", description: "Fora do mês", value: 100, status: "paid", paid_at: "2026-07-01T00:00", date: "2026-07-01" },
    ];
    const byDay = buildCalendarEvents(txs, 2026, 6);
    expect(Object.keys(byDay).sort()).toEqual(["2026-06-05", "2026-06-10", "2026-06-12"]);
    expect(byDay["2026-06-05"][0]).toMatchObject({ kind: "income", value: 5000, paid: true });
    expect(byDay["2026-06-10"][0]).toMatchObject({ kind: "expense", value: -1800, paid: false });
    expect(byDay["2026-06-12"][0]).toMatchObject({ kind: "invoice", value: -2340 });
  });

  it("monthSummary separa realizado (recebido/gasto) de previsto (a pagar)", () => {
    const byDay = buildCalendarEvents(
      [
        { type: "income", description: "S", value: 5000, status: "paid", paid_at: "2026-06-05" },
        { type: "expense", description: "M", value: 420, status: "paid", paid_at: "2026-06-15" },
        { type: "expense", description: "A", value: 1800, status: "confirmed", date: "2026-06-10" },
      ],
      2026,
      6,
    );
    const s = monthSummary(byDay);
    expect(s.received).toBe(5000);
    expect(s.spent).toBe(420);
    expect(s.toPay).toBe(1800);
    expect(s.net).toBe(5000 - 420 - 1800);
  });
});
