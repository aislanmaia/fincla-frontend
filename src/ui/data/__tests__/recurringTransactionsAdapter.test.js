import { describe, expect, it } from "vitest";
import {
  buildUpcomingRecurringSummary,
  mapRecurringSeriesToUi,
  mapRecurringSummaryToUi,
  mapRecurringTransactionToUi,
} from "../recurringTransactionsAdapter.js";

describe("recurringTransactionsAdapter", () => {
  it("mapeia série recorrente da API para o formato usado na UI", () => {
    expect(mapRecurringTransactionToUi({
      id: "rt-1",
      organization_id: "org-1",
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
    })).toEqual({
      id: "rt-1",
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
      startDateRaw: "2020-01-15",
      freqId: "mensal",
      methodId: "boleto",
      encId: "sem-fim",
      endDateRaw: null,
      creditCardId: null,
      categoryTagId: "t1",
      dayOfMonth: 13,
      dayOfWeek: null,
      interval: 1,
      intervalUnit: null,
      // A moeda da linha vem de `value_currency`, carimbado na fronteira. Sem
      // `value` canônico no fio ela é `null` — e `null` é lido como "a base da
      // organização", nunca como "real".
      moeda: null,
    });
  });

  it("carrega a moeda da própria linha quando o fio a declara", () => {
    // Uma série de € 1.200 desenhada "R$ 1.200,00" é número certo com unidade
    // errada — o defeito que o épico multi-moeda existe para matar.
    const linha = mapRecurringSeriesToUi({
      id: "rt-2",
      type: "expense",
      description: "Aluguel de Lisboa",
      value: 1200,
      value_currency: "EUR",
      value_kind: "exact",
      category: "Moradia",
      payment_method: "boleto",
      frequency: "monthly",
      start_date: "2026-01-01",
      next_occurrence: "2026-03-13",
      is_active: true,
      tags: [],
      interval: 1,
      interval_unit: null,
    });

    expect(linha.moeda).toBe("EUR");
    expect(linha.val).toBe(1200);
  });

  it("mapeia resumo mensal de recorrências", () => {
    expect(mapRecurringSummaryToUi({
      total_monthly_income: 8400,
      total_monthly_expense: 2100,
      active_count: 5,
      paused_count: 1,
      currency: "BRL",
      by_currency: [
        { currency: "BRL", total_monthly_income: 8400, total_monthly_expense: 2100, active_count: 5 },
      ],
    })).toEqual({
      totalRec: 8400,
      totalDesp: 2100,
      saldoFixo: 6300,
      moeda: "BRL",
      porMoeda: [
        { currency: "BRL", total_monthly_income: 8400, total_monthly_expense: 2100, active_count: 5 },
      ],
      activeCount: 5,
      pausedCount: 1,
    });
  });

  it("preserva a ausência do total quando a organização tem mais de uma moeda", () => {
    // O `|| 0` que estava aqui virava "R$ 0,00" na tela — a afirmação oposta à
    // que o backend fez ao mandar `null`. Quem responde é `porMoeda`.
    const resumo = mapRecurringSummaryToUi({
      total_monthly_income: null,
      total_monthly_expense: null,
      active_count: 2,
      paused_count: 0,
      currency: null,
      by_currency: [
        { currency: "BRL", total_monthly_income: 0, total_monthly_expense: 800, active_count: 1 },
        { currency: "EUR", total_monthly_income: 0, total_monthly_expense: 50, active_count: 1 },
      ],
    });

    expect(resumo.totalDesp).toBeNull();
    expect(resumo.totalRec).toBeNull();
    expect(resumo.saldoFixo).toBeNull();
    expect(resumo.moeda).toBeNull();
    expect(resumo.porMoeda.map((f) => f.currency)).toEqual(["BRL", "EUR"]);
    // A contagem não some: ela não tem moeda.
    expect(resumo.activeCount).toBe(2);
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
      moeda: null,
      porMoeda: [{ currency: null, total: 120 }],
    });
  });

  it("não soma vencimentos de moedas diferentes num total só", () => {
    // 120 + 50 = 170 seria um número de moeda nenhuma, no card ao lado do
    // resumo mensal que já aprendeu a não fazer isso.
    const resumo = buildUpcomingRecurringSummary([
      { ativa: true, tipo: "despesa", val: 120, moeda: "BRL", nextOccurrenceIso: "2026-03-25" },
      { ativa: true, tipo: "despesa", val: 50, moeda: "EUR", nextOccurrenceIso: "2026-03-26" },
    ], "2026-03-23");

    expect(resumo.total).toBeNull();
    expect(resumo.moeda).toBeNull();
    expect(resumo.porMoeda).toEqual([
      { currency: "BRL", total: 120 },
      { currency: "EUR", total: 50 },
    ]);
  });
});
