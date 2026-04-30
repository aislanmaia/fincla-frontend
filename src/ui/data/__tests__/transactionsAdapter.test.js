import { describe, expect, it, vi } from "vitest";
import {
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
  buildTransactionsSummaryQuery,
  buildTransactionsQuery,
  mapApiTransactionToUi,
} from "../transactionsAdapter.js";

describe("transactionsAdapter", () => {
  it("mapeia transacao parcelada da API para o formato usado na UI", () => {
    const mapped = mapApiTransactionToUi({
      id: 21,
      organization_id: "org-1",
      type: "expense",
      description: "MacBook Pro 14pol",
      category: null,
      tags: {
        categoria: [{ id: "tag-cat", name: "Compras" }],
        contexto: [{ id: "tag-ctx", name: "trabalho" }],
      },
      value: 3600,
      payment_method: "Crédito",
      date: "2026-03-18T10:00:00",
      status: "pending",
      recurring: false,
      created_at: "2026-03-18T10:00:00",
      updated_at: "2026-03-18T10:00:00",
      installment_info: [
        {
          installment_number: 1,
          total_installments: 12,
          due_date: "2026-04-10",
          amount: 300,
        },
      ],
      credit_card_charge: {
        charge: {
          id: 1,
          organization_id: "org-1",
          card_id: 10,
          transaction_id: 21,
          total_amount: 3600,
          installments_count: 12,
          modality: "installment",
          purchase_date: "2026-03-18T10:00:00",
        },
        card: {
          id: 10,
          organization_id: "org-1",
          last4: "1177",
          brand: "Nubank",
          due_day: 10,
          description: "Nubank",
        },
      },
    });

    expect(mapped).toMatchObject({
      id: 21,
      desc: "MacBook Pro 14pol",
      cat: "Compras",
      categoryTagId: "tag-cat",
      date: "10/04/2026",
      val: -300,
      method: "Crédito",
      status: "pendente",
      rec: false,
      tags: ["trabalho"],
      parcela: {
        atual: 1,
        total: 12,
        valParcela: 300,
        cartao: "Nubank •• 1177",
        vencimento: "10/04/2026",
        valorTotal: 3600,
        valorPago: 300,
        valorResidual: 3300,
      },
    });
  });

  it("crédito à vista 1/1x usa due_date na lista (não só a data da compra)", () => {
    const mapped = mapApiTransactionToUi({
      id: 493,
      organization_id: "org-1",
      type: "expense",
      description: "assinatura chatgpt",
      category: "Subscriptions & Software",
      tags: {},
      value: "95.99",
      payment_method: "credit_card",
      date: "2026-03-16T00:00:00",
      recurring: false,
      created_at: "2026-03-03T02:53:43.647040",
      updated_at: "2026-03-03T02:53:43.647040",
      credit_card_charge: {
        charge: {
          id: 330,
          organization_id: "org-1",
          card_id: 3,
          transaction_id: 493,
          total_amount: "95.99",
          installments_count: 1,
          modality: "cash",
          purchase_date: "2026-03-16",
        },
        card: {
          id: 3,
          organization_id: "org-1",
          last4: "2919",
          brand: "Visa",
          due_day: 10,
          description: "Visa - Azul",
        },
      },
      installment_info: [
        {
          installment_number: 1,
          total_installments: 1,
          due_date: "2026-04-10",
          amount: "95.99",
        },
      ],
    });

    expect(mapped.date).toBe("10/04/2026");
  });

  it("converte filtros da UI para query da API", () => {
    expect(
      buildTransactionsQuery({
        organizationId: "org-1",
        search: "uber",
        filterType: "despesa",
        filterCat: "Alimentação",
        filterMethod: "Crédito",
        period: "custom",
        customFrom: "2026-03-01",
        customTo: "2026-03-31",
        sortBy: "val-desc",
        limit: 20,
      }),
    ).toEqual({
      organization_id: "org-1",
      description: "uber",
      type: "expense",
      category: "Alimentação",
      payment_method: "Crédito",
      date_start: "2026-03-01",
      date_end: "2026-03-31",
      page: 1,
      limit: 20,
      sort_by: "value",
      sort_order: "desc",
    });
  });

  it("usa tag_id quando o filtro de categoria é UUID", () => {
    const tagId = "123e4567-e89b-12d3-a456-426614174000";
    expect(
      buildTransactionsQuery({
        organizationId: "org-1",
        filterCat: tagId,
        limit: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        organization_id: "org-1",
        tag_id: tagId,
      }),
    );
    expect(
      buildTransactionsSummaryQuery({
        organizationId: "org-1",
        filterCat: tagId,
      }),
    ).toEqual({
      organization_id: "org-1",
      tag_id: tagId,
    });
  });

  it("período Este mês: do dia 1 ao último dia do mês civil (não só até hoje)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-05T12:00:00"));
    expect(
      buildTransactionsQuery({
        organizationId: "org-1",
        period: "mes",
        limit: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        date_start: "2026-04-01",
        date_end: "2026-04-30",
      }),
    );
    vi.useRealTimers();
  });

  it("período Este mês em fevereiro bissexto termina em 29", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-15T12:00:00"));
    expect(
      buildTransactionsQuery({
        organizationId: "org-1",
        period: "mes",
        limit: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        date_start: "2024-02-01",
        date_end: "2024-02-29",
      }),
    );
    vi.useRealTimers();
  });

  it("gera query de summary sem paginação nem ordenação", () => {
    expect(
      buildTransactionsSummaryQuery({
        organizationId: "org-1",
        search: "freela",
        filterType: "receita",
        filterCat: "Receita",
        filterMethod: "Pix",
        period: "custom",
        customFrom: "2026-03-01",
        customTo: "2026-03-31",
      }),
    ).toEqual({
      organization_id: "org-1",
      description: "freela",
      type: "income",
      category: "Receita",
      payment_method: "Pix",
      date_start: "2026-03-01",
      date_end: "2026-03-31",
    });
  });

  it("POST create: nunca inclui card_last4; parcelado envia installments_count", () => {
    const cash = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Loja",
      value: 100,
      paymentMethodKey: "credito",
      categoryTagId: "cat-uuid",
      dateIso: "2026-04-01T12:00:00",
      cardId: 3,
      modality: "cash",
    });
    expect(cash).not.toHaveProperty("card_last4");
    expect(cash).toMatchObject({
      card_id: 3,
      modality: "cash",
      payment_method: "credit_card",
    });
    expect(cash).not.toHaveProperty("installments_count");

    const inst = buildCreateTransactionPayload({
      organizationId: "org-1",
      tipo: "despesa",
      description: "Parcelado",
      value: 600,
      paymentMethodKey: "credito",
      categoryTagId: "cat-uuid",
      dateIso: "2026-04-01T12:00:00",
      cardId: 3,
      modality: "installment",
      installmentsCount: 3,
    });
    expect(inst).not.toHaveProperty("card_last4");
    expect(inst).toMatchObject({
      modality: "installment",
      installments_count: 3,
    });
  });

  it("PUT update: não inclui card_last4; cartão usa card_id e parcelas como no POST", () => {
    const body = buildUpdateTransactionPayload({
      tipo: "despesa",
      description: "Ajuste",
      value: 200,
      paymentMethodKey: "credito",
      categoryTagId: "cat-uuid",
      dateIso: "2026-04-10T12:00:00",
      cardId: 5,
      modality: "installment",
      installmentsCount: 6,
      recurring: false,
    });
    expect(body).not.toHaveProperty("card_last4");
    expect(body).toMatchObject({
      card_id: 5,
      modality: "installment",
      installments_count: 6,
      payment_method: "credit_card",
    });
  });
});
