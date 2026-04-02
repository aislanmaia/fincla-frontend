import { describe, expect, it } from "vitest";
import {
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
});
