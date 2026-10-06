import { describe, expect, it } from "vitest";
import {
  buildCategoryRows,
  buildDashboardInvoices,
  buildDonutArcs,
  groupCategoryRows,
  isForecastInvoice,
  timelineProgress,
} from "../invoiceDashboardModel.js";

const card = { id: 1, closing_day: 15, due_day: 10 };
const now = new Date(2026, 9, 4, 12);
const m = (a) => ({ amount: a, currency: "BRL" });

describe("isForecastInvoice", () => {
  it("só é previsão o que vem depois da fatura aberta", () => {
    expect(isForecastInvoice(card, 2026, 10, now)).toBe(false);
    expect(isForecastInvoice(card, 2026, 9, now)).toBe(false);
    expect(isForecastInvoice(card, 2026, 11, now)).toBe(true);
  });
});

describe("buildDashboardInvoices", () => {
  it("a fatura aberta ausente do histórico entra com total desconhecido (null), nunca zero", () => {
    const late = new Date(2026, 9, 20, 12);
    const list = buildDashboardInvoices({
      card,
      history: { monthly_data: [{ year: 2026, month: 10, status: "closed", total_amount: 100, items_count: 3, top_category: null }] },
      future: { monthly_breakdown: [] },
      selected: { year: 2026, month: 11, state: "loading", detail: null },
      now: late,
    });
    const open = list.find((i) => i.key === "2026-11");
    expect(open.status).toBe("open");
    expect(open.total).toBeNull();
    expect(open.summaryKnown).toBe(false);
  });

  it("o detalhe da selecionada sobrepõe o resumo do histórico", () => {
    const list = buildDashboardInvoices({
      card,
      history: { monthly_data: [{ year: 2026, month: 9, status: "closed", total_amount: 1, items_count: 1, top_category: null }] },
      future: null,
      selected: { year: 2026, month: 9, state: "ok", detail: { status: "paid", total_amount: 6940, items_count: 58, paid_date: "2026-09-09", category_breakdown: [] } },
      now,
    });
    const sept = list.find((i) => i.key === "2026-09");
    expect(sept).toMatchObject({ status: "paid", total: 6940, itemsCount: 58, paidDate: "2026-09-09" });
  });

  it("404 do detalhe vira fatura vazia, não erro", () => {
    const list = buildDashboardInvoices({ card, history: null, future: null, selected: { year: 2026, month: 10, state: "empty", detail: null }, now });
    expect(list.find((i) => i.key === "2026-10")).toMatchObject({ isEmpty: true, total: null, itemsCount: 0, status: "open" });
  });
});

describe("categorias", () => {
  const rows = buildCategoryRows([
    { category_id: "a", category_name: "Food", category_color: "#111111", total: 60, percentage: 60, transaction_count: 3 },
    { category_id: null, category_name: "Sem Categoria", category_color: null, total: 40, percentage: 40, transaction_count: 1 },
  ]);

  it("traduz o nome, mantém cor da API e dá cinza fixo para sem categoria", () => {
    expect(rows[0].color).toBe("#111111");
    expect(rows[1].color).toBe("#6B7280");
  });

  it("os arcos do donut somam 1 e ignoram fatias negativas ou desconhecidas", () => {
    const arcs = buildDonutArcs([...rows, { key: "r", color: "#000", total: -10, percentage: null }, { key: "n", color: "#000", total: null, percentage: null }]);
    expect(arcs.map((a) => a.key)).toHaveLength(2);
    expect(arcs.reduce((s, a) => s + a.fraction, 0)).toBeCloseTo(1);
    expect(arcs[1].offset).toBeCloseTo(0.6);
  });

  it("sem nenhum valor positivo não há donut", () => {
    expect(buildDonutArcs([{ key: "x", color: "#000", total: 0, percentage: 0 }])).toEqual([]);
  });

  it("agrupa o excedente em Outras somando total e percentual", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, name: `C${i}`, color: "#000", total: 10, percentage: 12.5, count: 1 }));
    const { visible } = groupCategoryRows(many, 5);
    expect(visible).toHaveLength(6);
    expect(visible[5]).toMatchObject({ name: "Outras", total: 30, percentage: 37.5, isOthers: true });
  });

  it("Outras fica desconhecida se alguma categoria do resto não tem total", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ key: `k${i}`, name: `C${i}`, color: "#000", total: i === 6 ? null : 10, percentage: null, count: 1 }));
    expect(groupCategoryRows(many, 5).visible[5].total).toBeNull();
  });
});

describe("timelineProgress", () => {
  it("antes do fechamento a barra não anda", () => {
    expect(timelineProgress({ closingDate: "2026-10-15", dueDate: "2026-10-25" }, new Date(2026, 9, 4))).toEqual({ pct: 0, beforeClosing: true, afterDue: false });
  });
  it("entre fechamento e vencimento anda proporcionalmente", () => {
    const p = timelineProgress({ closingDate: "2026-10-01", dueDate: "2026-10-11" }, new Date(2026, 9, 6));
    expect(p.pct).toBe(50);
  });
  it("sem data de fechamento só diz se já venceu; sem vencimento não há timeline", () => {
    expect(timelineProgress({ closingDate: null, dueDate: "2026-10-01" }, new Date(2026, 9, 6))).toEqual({ pct: null, beforeClosing: false, afterDue: true });
    expect(timelineProgress({ closingDate: null, dueDate: null }, new Date())).toBeNull();
  });
});
