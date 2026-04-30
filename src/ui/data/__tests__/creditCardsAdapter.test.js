import { describe, expect, it } from "vitest";
import {
  buildCreateCreditCardPayload,
  buildUpdateCreditCardPayload,
  mapCreditCardToUi,
} from "../creditCardsAdapter.js";

describe("creditCardsAdapter", () => {
  it("mapeia cartão com fatura atual para o formato da UI", () => {
    const card = mapCreditCardToUi({
      card: {
        id: 7,
        organization_id: "org-1",
        last4: "4321",
        brand: "Visa",
        due_day: 10,
        description: "Cartão principal",
        credit_limit: 5000,
        closing_day: 3,
        color: "#2563EB",
        available_limit: 3200,
        used_limit: 1800,
        limit_usage_percent: 36,
      },
      currentInvoice: {
        month: "2026-03",
        due_date: "2026-04-10",
        total_amount: 1840,
        status: "open",
        items: [
          {
            id: 91,
            charge_id: 18,
            transaction_date: "2026-03-08",
            description: "iPhone",
            amount: 420,
            installment_number: 3,
            total_installments: 12,
            tags: { categories: [{ id: "t1", name: "Eletrônicos", color: "#0891B2", is_default: false, is_active: true, organization_id: "org-1", tag_type: null }] },
            purchase_info: {
              purchase_date: "2026-01-08",
              total_value: 5040,
              last_installment_date: "2026-12-10",
              remaining_after_this: 9,
            },
          },
        ],
        closing_date: "2026-04-03",
        days_until_due: 18,
        is_overdue: false,
        paid_date: null,
        previous_month_total: 1420,
        month_over_month_change: 29.6,
        limit_usage_percent: 36,
        items_count: 1,
        category_breakdown: [
          {
            category_id: "t1",
            category_name: "Eletrônicos",
            category_color: "#0891B2",
            total: 420,
            percentage: 100,
            transaction_count: 1,
          },
        ],
      },
      history: {
        card_id: 7,
        card_name: "Visa •• 4321",
        period_start: "2025-10-01",
        period_end: "2026-03-31",
        summary: {
          total_spent: 8040,
          average_monthly: 1340,
          highest_month: { month: "Dec 2025", amount: 2310 },
          lowest_month: { month: "Feb 2026", amount: 1420 },
        },
        monthly_data: [
          { year: 2026, month: 2, month_name: "February", total_amount: 1420, status: "paid", items_count: 8, top_category: "Assinaturas" },
        ],
      },
      futureCommitments: {
        card_id: 7,
        card_name: "Visa",
        card_last4: "4321",
        credit_limit: 5000,
        current_available_limit: 3200,
        summary: {
          total_committed: 3780,
          average_monthly: 420,
          lowest_month: null,
          highest_month: null,
        },
        monthly_breakdown: [],
        ending_soon: [],
        insights: [],
      },
    });

    expect(card.id).toBe("7");
    expect(card.faturas.at(-1)).toMatchObject({
      mes: "Mar'26",
      val: 1840,
      atual: true,
      pago: false,
    });
    expect(card.itens[0]).toMatchObject({
      desc: "iPhone",
      cat: "Eletrônicos",
      val: 420,
      data: "08/03",
      parcela: { n: 3, t: 12, val: 420, total: 5040 },
    });
    expect(card.parcelas_ativas[0]).toMatchObject({
      desc: "iPhone",
      vParcela: 420,
      pago: 2,
      total: 12,
      vTotal: 5040,
    });
  });

  it("não duplica parcelas futuras no agregado", () => {
    const card = mapCreditCardToUi({
      card: {
        id: 8,
        organization_id: "org-1",
        last4: "9999",
        brand: "Mastercard",
        due_day: 5,
        description: "Teste",
        credit_limit: 3000,
        closing_day: 28,
        color: null,
        available_limit: 2000,
        used_limit: 1000,
        limit_usage_percent: 33,
      },
      currentInvoice: {
        month: "2026-03",
        due_date: "2026-04-05",
        total_amount: 300,
        status: "open",
        items: [
          {
            id: 11,
            charge_id: 22,
            transaction_date: "2026-03-02",
            description: "Curso",
            amount: 300,
            installment_number: 1,
            total_installments: 3,
            tags: { categories: [{ id: "t1", name: "Educação", color: "#BE185D", is_default: false, is_active: true, organization_id: "org-1", tag_type: null }] },
            purchase_info: {
              purchase_date: "2026-03-02",
              total_value: 900,
              last_installment_date: "2026-05-05",
              remaining_after_this: 2,
            },
          },
        ],
        closing_date: "2026-03-28",
        days_until_due: 10,
        is_overdue: false,
        paid_date: null,
        previous_month_total: null,
        month_over_month_change: null,
        limit_usage_percent: 10,
        items_count: 1,
        category_breakdown: [],
      },
      history: { card_id: 8, card_name: "Teste", period_start: "", period_end: "", summary: { total_spent: 300, average_monthly: 300, highest_month: null, lowest_month: null }, monthly_data: [] },
      futureCommitments: {
        card_id: 8,
        card_name: "Teste",
        card_last4: "9999",
        credit_limit: 3000,
        current_available_limit: 2000,
        summary: { total_committed: 600, average_monthly: 300, lowest_month: null, highest_month: null },
        monthly_breakdown: [
          {
            year: 2026,
            month: 4,
            month_name: "April",
            total_amount: 300,
            limit_usage_percent: 10,
            installments_count: 1,
            top_installments: [{ description: "Curso", amount: 300, installment_number: 2, total_installments: 3, category_name: "Educação", category_color: "#BE185D" }],
          },
        ],
        ending_soon: [],
        insights: [],
      },
    });

    expect(card.parcelas_ativas).toHaveLength(1);
  });

  it("monta payload de criação de cartão a partir do formulário da UI", () => {
    expect(buildCreateCreditCardPayload({
      organizationId: "org-1",
      brand: "Visa",
      displayName: "Cartão principal",
      last4Digits: "1234",
      limitInput: "4.800,50",
      dueDay: "10",
      closingDay: "3",
      color: "#2563EB",
    })).toEqual({
      organization_id: "org-1",
      last4: "1234",
      brand: "Visa",
      due_day: 10,
      description: "Cartão principal",
      credit_limit: 4800.5,
      closing_day: 3,
      color: "#2563EB",
    });
  });

  it("monta payload de atualização de cartão (PATCH)", () => {
    expect(
      buildUpdateCreditCardPayload({
        organizationId: "org-1",
        brand: "Mastercard",
        displayName: "Nubank Roxo",
        last4Digits: "5678",
        limitInput: "2.000,00",
        dueDay: "15",
        closingDay: "2",
      }),
    ).toEqual({
      organization_id: "org-1",
      brand: "Mastercard",
      description: "Nubank Roxo",
      last4: "5678",
      credit_limit: 2000,
      due_day: 15,
      closing_day: 2,
    });
  });
});
