import { describe, expect, it } from "vitest";
import {
  buildUpcomingRecurringSummary,
  mapRecurringSummaryToUi,
  mapRecurringTransactionToUi,
} from "../recurringTransactionsAdapter.js";

describe("recurringTransactionsAdapter", () => {
  it("mapeia série recorrente da API para o formato usado na UI", () => {
    expect(mapRecurringTransactionToUi({
      id: "rt-1",
      organization_id: "org-1",
      logical_series_id: "log-1",
      type: "expense",
      description: "Conta de luz",
      value: 180,
      value_kind: "exact",
      category: "Utilidades",
      payment_method: "boleto",
      frequency: "monthly",
      start_date: "2020-01-15",
      next_occurrence: "2026-03-13",
      is_active: true,
      created_at: "",
      updated_at: "",
      tags: [{ id: "t1", name: "Utilidades", color: "#2563EB", icon_key: null, is_default: false, is_active: true, organization_id: "org-1", tag_type: { id: "tt1", name: "categoria" } }],
      day_of_month: 13,
      day_of_week: null,
      end_date: null,
      credit_card_id: null,
      notes: null,
      replaces_series_id: null,
    })).toEqual({
      id: "rt-1",
      logicalSeriesId: "log-1",
      desc: "Conta de luz",
      cat: "Utilidades",
      val: 180,
      dia: 13,
      ativa: true,
      proximo: "13/03/2026",
      proximoFull: "13/03/2026",
      tipo: "despesa",
      metodo: "Boleto",
      freq: "Mensal · dia 13",
      inicio: "Jan 2020",
      enc: "Sem data fim",
      urgente: false,
      diasUrg: null,
      pago: false,
      categoryIconKey: null,
      valorTipo: "fixo",
      progPct: 0,
      status: "ativa",
      nextOccurrenceIso: "2026-03-13",
      freqId: "mensal",
      methodId: "boleto",
      encId: "sem-fim",
      endDateRaw: null,
      creditCardId: null,
      categoryTagId: "t1",
    });
  });

  it("mapeia resumo mensal de recorrências", () => {
    expect(mapRecurringSummaryToUi({
      total_monthly_income: 8400,
      total_monthly_expense: 2100,
      active_count: 5,
      paused_count: 1,
    })).toEqual({
      totalRec: 8400,
      totalDesp: 2100,
      saldoFixo: 6300,
      activeCount: 5,
      pausedCount: 1,
    });
  });

  it("considera apenas despesas ativas nos próximos 7 dias", () => {
    expect(buildUpcomingRecurringSummary([
      { ativa: true, tipo: "despesa", val: 120, nextOccurrenceIso: "2026-03-25" },
      { ativa: false, tipo: "despesa", val: 80, nextOccurrenceIso: "2026-03-24" },
      { ativa: true, tipo: "receita", val: 900, nextOccurrenceIso: "2026-03-23" },
      { ativa: true, tipo: "despesa", val: 50, nextOccurrenceIso: "2026-04-10" },
    ], "2026-03-23")).toEqual({
      items: [{ ativa: true, tipo: "despesa", val: 120, nextOccurrenceIso: "2026-03-25" }],
      total: 120,
    });
  });
});
