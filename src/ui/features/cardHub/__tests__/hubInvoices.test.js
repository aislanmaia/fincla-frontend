import { describe, expect, it } from "vitest";

import {
  buildInvoiceCards,
  defaultInvoiceKey,
  describeDue,
  dueDateFor,
  summarizeInvoiceCounts,
} from "../hubInvoices.js";

const NOW = new Date(2026, 9, 4); // 04/10/2026
const CARD = { id: 1, closing_day: 15, due_day: 10 };

const hist = (year, month, status, total, items = 5) => ({
  year, month, month_name: "", total_amount: total, status, items_count: items, top_category: "Mercado",
});

const HISTORY = {
  monthly_data: [
    hist(2026, 7, "paid", 6512.4, 47),
    hist(2026, 8, "paid", 7340, 51),
    hist(2026, 9, "closed", 6940, 58),
    hist(2026, 10, "open", 8129.51, 62),
  ],
};
const CURRENT = {
  month: "2026-10", due_date: "2026-10-10", total_amount: 8129.51, status: "open", items_count: 62,
  paid_date: null, limit_usage_percent: 65,
  category_breakdown: [{ category_name: "Alimentação", total: 900 }, { category_name: "Transporte", total: 300 }],
};
const FUTURE = {
  monthly_breakdown: [
    { year: 2026, month: 10, total_amount: 111, installments_count: 9, limit_usage_percent: 1 },
    { year: 2026, month: 11, total_amount: 6050.28, installments_count: 7, limit_usage_percent: 20 },
    { year: 2026, month: 12, total_amount: 5050.27, installments_count: 5, limit_usage_percent: 15 },
  ],
};

const build = (over = {}) => buildInvoiceCards({
  card: CARD, history: HISTORY, current: CURRENT, currentState: "ok", future: FUTURE, now: NOW, ...over,
});

describe("buildInvoiceCards", () => {
  it("junta histórico, fatura aberta e futuras em ordem cronológica, com os 4 status", () => {
    const cards = build();
    expect(cards.map((c) => [c.key, c.status])).toEqual([
      ["2026-07", "paid"],
      ["2026-08", "paid"],
      ["2026-09", "closed"],
      ["2026-10", "open"],
      ["2026-11", "forecast"],
      ["2026-12", "forecast"],
    ]);
  });

  it("a fatura aberta vem do /current, não do histórico (total, vencimento e limite)", () => {
    const open = build().find((c) => c.key === "2026-10");
    expect(open).toMatchObject({ total: 8129.51, itemsCount: 62, dueDate: "2026-10-10", limitUsagePercent: 65 });
    expect(open.topCategory).toBe("Alimentação");
  });

  it("mês passado que o histórico chama de open (sem registro de fatura) é Fechada, não Aberta", () => {
    const history = { monthly_data: [hist(2026, 8, "open", 100), hist(2026, 10, "open", 8129.51)] };
    const cards = build({ history });
    expect(cards.find((c) => c.key === "2026-08").status).toBe("closed");
    expect(cards.find((c) => c.key === "2026-10").status).toBe("open");
  });

  it("404 na fatura aberta vira estado vazio: Aberta sem total, nunca zero", () => {
    const cards = build({ current: null, currentState: "empty", history: { monthly_data: [hist(2026, 9, "paid", 100)] } });
    const open = cards.find((c) => c.status === "open");
    expect(open).toMatchObject({ key: "2026-10", isEmpty: true, total: null, itemsCount: 0 });
  });

  it("falha na fatura aberta (não 404) não inventa uma fatura vazia", () => {
    const cards = build({ current: null, currentState: "unavailable", history: { monthly_data: [hist(2026, 9, "paid", 100)] } });
    expect(cards.some((c) => c.isEmpty)).toBe(false);
    expect(cards.find((c) => c.key === "2026-10")).toBeUndefined();
  });

  it("compromisso futuro de mês já aberto ou passado não vira Prevista", () => {
    const cards = build();
    expect(cards.filter((c) => c.status === "forecast").map((c) => c.key)).toEqual(["2026-11", "2026-12"]);
    expect(cards.find((c) => c.key === "2026-10").status).toBe("open");
  });

  it("variação só entre meses adjacentes, e nula quando falta o mês anterior", () => {
    const cards = build({ history: { monthly_data: [hist(2026, 8, "paid", 7000), hist(2026, 10, "open", 8129.51)] } });
    expect(cards.find((c) => c.key === "2026-10").vsPercent).toBeNull();
    const all = build();
    expect(all.find((c) => c.key === "2026-09").vsPercent).toBe(-5);
    expect(all.find((c) => c.key === "2026-09").prevKey).toBe("2026-08");
  });

  it("usa a variação informada pela fatura atual mesmo quando o histórico falha", () => {
    const cards = build({ history: null, current: { ...CURRENT, month_over_month_change: 17.1 } });
    expect(cards.find((c) => c.key === "2026-10").vsPercent).toBe(17.1);
  });

  it("valor ausente fica null (não zero)", () => {
    const cards = build({ history: { monthly_data: [{ ...hist(2026, 9, "paid", null) }] }, current: null, currentState: "unavailable", future: null });
    expect(cards[0].total).toBeNull();
  });
});

describe("defaultInvoiceKey / summarizeInvoiceCounts / describeDue", () => {
  it("abre na fatura aberta; sem ela, na última emitida", () => {
    expect(defaultInvoiceKey(build())).toBe("2026-10");
    const noOpen = build({ current: null, currentState: "unavailable", history: { monthly_data: [hist(2026, 8, "paid", 1), hist(2026, 9, "paid", 1)] } });
    expect(defaultInvoiceKey(noOpen)).toBe("2026-09");
    expect(defaultInvoiceKey([])).toBeNull();
  });

  it("resume as contagens por status, só as que existem", () => {
    expect(summarizeInvoiceCounts(build())).toBe("2 pagas · 1 fechada · 1 aberta · 2 previstas");
  });

  it("conta a fatura vencida como vencida, nunca também como fechada", () => {
    const cards = build().map((c) => (c.status === "closed" ? { ...c, overdue: true } : c));
    expect(summarizeInvoiceCounts(cards)).toBe("2 pagas · 1 vencida · 1 aberta · 2 previstas");
  });

  it("vencida paga ou prevista não conta como vencida", () => {
    const cards = build().map((c) => (c.status === "paid" || c.status === "forecast" ? { ...c, overdue: true } : c));
    expect(summarizeInvoiceCounts(cards)).toBe("2 pagas · 1 fechada · 1 aberta · 2 previstas");
  });

  it("descreve o vencimento relativo a hoje", () => {
    expect(describeDue("2026-10-10", NOW)).toBe("vence em 6 dias (10/10)");
    expect(describeDue("2026-10-04", NOW)).toBe("vence hoje (04/10)");
    expect(describeDue("2026-10-01", NOW)).toBe("venceu há 3 dias (01/10)");
  });
});

describe("linha do histórico 'open' fora do mês aberto", () => {
  it("posterior à fatura aberta é Prevista, e nunca existem duas abertas", () => {
    const history = { monthly_data: [hist(2026, 9, "paid", 1), hist(2026, 10, "open", 8129.51), hist(2026, 11, "open", 50)] };
    const cards = build({ history, future: null });
    expect(cards.find((c) => c.key === "2026-11").status).toBe("forecast");
    expect(cards.filter((c) => c.status === "open")).toHaveLength(1);
    expect(defaultInvoiceKey(cards)).toBe("2026-10");
  });
});

describe("dueDateFor — vencimento da fatura identificada pelo mês do fechamento", () => {
  it("cai no mês seguinte quando o vencimento não vem depois do fechamento (fecha 25, vence 5)", () => {
    expect(dueDateFor(2026, 12, 5, 25)).toBe("2027-01-05");
    expect(dueDateFor(2026, 10, 5, 25)).toBe("2026-11-05");
    expect(dueDateFor(2026, 10, 25, 25)).toBe("2026-11-25");
  });

  it("fica no mesmo mês quando o vencimento vem depois do fechamento", () => {
    expect(dueDateFor(2026, 11, 10, 3)).toBe("2026-11-10");
  });

  it("usa o último dia do mês de vencimento quando o dia não existe nele", () => {
    expect(dueDateFor(2027, 1, 31, 31)).toBe("2027-02-28");
    expect(dueDateFor(2027, 2, 31, 30)).toBe("2027-03-31"); // fev: fecha e vence dia 28, o vencimento vai para março
  });

  it("a linha do histórico do Hub traz o vencimento do mês seguinte para cartão que fecha depois de vencer", () => {
    const card = { id: 7, closing_day: 25, due_day: 5 };
    const cards = buildInvoiceCards({
      card,
      history: { monthly_data: [hist(2026, 9, "closed", 100)] },
      current: null,
      currentState: "empty",
      future: null,
      now: new Date(2026, 9, 26),
    });
    expect(cards.find((c) => c.key === "2026-09").dueDate).toBe("2026-10-05");
  });
});

describe("vencimento nas linhas de previsão e do mês aberto vazio", () => {
  const card = { id: 7, closing_day: 25, due_day: 5 };

  it("a fatura aberta sem lançamentos e a prevista trazem o vencimento do mês seguinte", () => {
    const cards = buildInvoiceCards({
      card,
      history: { monthly_data: [] },
      current: null,
      currentState: "empty",
      future: { monthly_breakdown: [{ year: 2026, month: 12, total_amount: 50, installments_count: 1 }] },
      now: new Date(2026, 9, 20),
    });
    expect(cards.find((c) => c.key === "2026-10").dueDate).toBe("2026-11-05");
    expect(cards.find((c) => c.key === "2026-12").dueDate).toBe("2027-01-05");
  });

  it("cartão legado sem dia de fechamento usa a sugestão (vencimento - 7)", () => {
    const cards = buildInvoiceCards({
      card: { id: 8, closing_day: null, due_day: 5 },
      history: { monthly_data: [hist(2026, 9, "closed", 100)] },
      current: null,
      currentState: "empty",
      future: null,
      now: new Date(2026, 9, 20),
    });
    expect(cards.find((c) => c.key === "2026-09").dueDate).toBe("2026-10-05");
  });
});
