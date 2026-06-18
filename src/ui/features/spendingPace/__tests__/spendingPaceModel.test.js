import { describe, expect, it } from "vitest";
import {
  aggregateExpenseByDay,
  buildBudgetOvershootDay,
  buildDowAverages,
  buildSpendingPaceChartRowsCurrent,
  buildSpendingPaceChartRowsPastLight,
  cumulativeFromDaily,
  getSpendingPaceMonthContext,
  transactionDayKey,
} from "../spendingPaceModel.js";

describe("getSpendingPaceMonthContext", () => {
  it("marks current month", () => {
    const now = new Date(2026, 2, 18);
    const ctx = getSpendingPaceMonthContext(2026, 3, now);
    expect(ctx.viewMode).toBe("current");
    expect(ctx.daysInMonth).toBe(31);
    expect(ctx.todayInView).toBe(18);
    expect(ctx.start).toBe("2026-03-01");
    expect(ctx.end).toBe("2026-03-31");
  });

  it("marks past month as pastLight", () => {
    const now = new Date(2026, 2, 18);
    const ctx = getSpendingPaceMonthContext(2026, 2, now);
    expect(ctx.viewMode).toBe("pastLight");
    expect(ctx.todayInView).toBe(28);
  });
});

describe("aggregateExpenseByDay", () => {
  it("sums expenses by calendar day", () => {
    const tx = [
      { type: "expense", date: "2026-03-05T12:00:00", value: 100 },
      { type: "expense", date: "2026-03-05T12:00:00", value: 50 },
      { type: "income", date: "2026-03-05T12:00:00", value: 999 },
    ];
    const daily = aggregateExpenseByDay(tx, 2026, 3, 31);
    expect(daily[5]).toBe(150);
    expect(daily[1]).toBe(0);
  });

  it("cartão parcelado: cada parcela (transação) cai no seu dia de vencimento", () => {
    // Occurrence-based: a parcela é uma transação cuja data é o vencimento.
    const tx = [
      {
        type: "expense",
        date: "2026-03-12T12:00:00",
        value: 300,
        credit_card_id: 7,
        series_id: "series-1",
        installment_info: [
          { installment_number: 2, total_installments: 3, due_date: "2026-03-12", amount: 300 },
        ],
      },
    ];
    const daily = aggregateExpenseByDay(tx, 2026, 3, 31);
    expect(daily[12]).toBe(300);
  });
});

describe("buildSpendingPaceChartRowsCurrent", () => {
  it("builds proj, real until today, ritmo after", () => {
    const expensesByDay = Array(32).fill(0);
    expensesByDay[1] = 100;
    expensesByDay[2] = 100;
    const rows = buildSpendingPaceChartRowsCurrent({
      expensesByDay,
      totalBudgeted: 3100,
      daysInMonth: 31,
      todayInView: 2,
    });
    expect(rows[0].day).toBe(1);
    expect(rows[0].real).toBe(100);
    expect(rows[1].real).toBe(200);
    expect(rows[1].proj).toBe(Math.round((3100 / 31) * 2));
    expect(rows[2].real).toBe(null);
    expect(rows[2].ritmoAtual).toBeGreaterThan(200);
  });

  it("handles zero budget projection", () => {
    const daily = Array(32).fill(0);
    const rows = buildSpendingPaceChartRowsCurrent({
      expensesByDay: daily,
      totalBudgeted: 0,
      daysInMonth: 31,
      todayInView: 10,
    });
    expect(rows[9].proj).toBe(0);
  });
});

describe("buildSpendingPaceChartRowsPastLight", () => {
  it("fills real for all days", () => {
    const expensesByDay = Array(32).fill(0);
    expensesByDay[1] = 50;
    expensesByDay[2] = 50;
    const rows = buildSpendingPaceChartRowsPastLight({
      expensesByDay,
      daysInMonth: 28,
    });
    expect(rows.length).toBe(28);
    expect(rows[0].real).toBe(50);
    expect(rows[1].real).toBe(100);
    expect(rows[1].proj).toBe(null);
  });
});

describe("buildBudgetOvershootDay", () => {
  it("returns null when no spend", () => {
    expect(buildBudgetOvershootDay(3000, 0, 10)).toBe(null);
  });

  it("computes overshoot day from average", () => {
    const day = buildBudgetOvershootDay(3000, 1000, 10);
    expect(day).toBe(30);
  });
});

describe("transactionDayKey", () => {
  it("parses iso date", () => {
    expect(transactionDayKey("2026-02-15T00:00:00")).toEqual({
      y: 2026,
      m: 2,
      d: 15,
    });
  });
});

describe("cumulativeFromDaily", () => {
  it("accumulates", () => {
    const d = Array(5).fill(0);
    d[1] = 10;
    d[2] = 20;
    const c = cumulativeFromDaily(d, 4);
    expect(c[2]).toBe(30);
  });
});

describe("buildDowAverages", () => {
  it("averages per weekday in month", () => {
    const tx = [
      { type: "expense", date: "2026-03-03T12:00:00", value: 300 },
    ];
    const out = buildDowAverages(tx, 2026, 3, 31);
    expect(out.length).toBe(7);
    const tuesday = out.find((x) => x.day === "Ter");
    expect(tuesday.val).toBeGreaterThan(0);
  });
});
