import { describe, expect, it } from "vitest";

import { buildOverdueInsight } from "../overdueInvoices.js";
import { buildInvoiceCards, invoiceStatusLabel } from "../hubInvoices.js";

const PUBLIC_ID = "00000000-0000-4000-8000-000000000001";
const cards = [{ id: 1, public_id: PUBLIC_ID }];
const brl = (amount) => ({ amount, currency: "BRL" });
const summary = (over = {}) => ({
  count: 2,
  total_amount: brl(1350),
  by_currency: [brl(1350)],
  oldest_due_date: "2026-08-10",
  items: [{ credit_card_id: 1, card_name: "Azul", invoice_id: 41, month: "2026-07", due_date: "2026-08-10", amount: brl(1000), days_overdue: 55 }],
  ...over,
});

describe("buildOverdueInsight", () => {
  it("é null sem faturas vencidas ou sem resposta", () => {
    expect(buildOverdueInsight(null, cards)).toBeNull();
    expect(buildOverdueInsight(summary({ count: 0, items: [], total_amount: null, by_currency: [] }), cards)).toBeNull();
  });

  it("leva à fatura mais atrasada (a primeira)", () => {
    const insight = buildOverdueInsight(summary(), cards);
    expect(insight.type).toBe("overdue_invoices");
    expect(insight.href).toBe(`/cards/${PUBLIC_ID}/invoices/2026/7`);
  });

  it("oferece a saída 'Já paguei' junto do link; sem link, sem ação", () => {
    expect(buildOverdueInsight(summary(), cards).actionLabel).toBe("Já paguei — marcar como paga");
    expect(buildOverdueInsight(summary(), []).actionLabel).toBeNull();
  });

  it("sem o cartão carregado mantém o aviso, só sem link", () => {
    const insight = buildOverdueInsight(summary(), []);
    expect(insight.message).toContain("2 faturas vencidas");
    expect(insight.href).toBeNull();
  });

  it("nunca soma moedas: sem total, mostra cada uma", () => {
    const insight = buildOverdueInsight(summary({ total_amount: null, by_currency: [brl(100), { amount: 20, currency: "EUR" }] }), cards);
    expect(insight.message.replace(/\s/g, " ")).toBe("Você tem 2 faturas vencidas — R$ 100,00 + € 20,00");
  });
});

describe("selo de fatura vencida", () => {
  it("o rótulo vira Vencida só para fatura não paga com atraso afirmado", () => {
    expect(invoiceStatusLabel({ status: "closed", overdue: true })).toBe("Vencida");
    expect(invoiceStatusLabel({ status: "open", overdue: true })).toBe("Vencida");
    expect(invoiceStatusLabel({ status: "closed", overdue: false })).toBe("Fechada");
    expect(invoiceStatusLabel({ status: "paid", overdue: true })).toBe("Paga");
  });

  it("o histórico carrega is_overdue para a fatura (ausente = não vencida)", () => {
    const history = { monthly_data: [
      { year: 2026, month: 8, status: "closed", total_amount: 10, items_count: 1, is_overdue: true },
      { year: 2026, month: 9, status: "closed", total_amount: 10, items_count: 1 },
    ] };
    const cardsBuilt = buildInvoiceCards({ card: { due_day: 10, closing_day: 3 }, history, current: null, currentState: "unavailable", future: null, now: new Date(2026, 9, 4) });
    expect(cardsBuilt.find((c) => c.key === "2026-08").overdue).toBe(true);
    expect(cardsBuilt.find((c) => c.key === "2026-09").overdue).toBe(false);
  });

  it("usa o vencimento do servidor e nunca marca paga ou prevista como vencida", () => {
    const history = { monthly_data: [
      { year: 2026, month: 7, status: "closed", total_amount: 10, items_count: 1, is_overdue: true, due_date: "2026-08-12" },
      { year: 2026, month: 8, status: "paid", total_amount: 10, items_count: 1, is_overdue: true },
    ] };
    const built = buildInvoiceCards({ card: { due_day: 10, closing_day: 3 }, history, current: null, currentState: "unavailable", future: null, now: new Date(2026, 9, 4) });
    expect(built.find((c) => c.key === "2026-07").dueDate).toBe("2026-08-12");
    expect(built.find((c) => c.key === "2026-08").overdue).toBe(false);
  });
});
