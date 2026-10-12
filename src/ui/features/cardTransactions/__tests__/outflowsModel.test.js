import { describe, expect, it } from "vitest";
import { buildOutflows } from "../outflowsModel.js";

const NOW = new Date(2026, 9, 12);
const row = (year, month, amount, extra = {}) => ({ invoice_id: year * 100 + month, year, month, amount, amount_currency: "BRL", ...extra });
const projected = (year, month, amount, extra = {}) => ({ year, month, amount, amount_currency: "BRL", count: 7, approximate: false, ...extra });
const build = (breakdown, over = {}) => buildOutflows({ mode: "invoices", summary: { breakdown }, ladder: null, selectedKeys: [], selectableKeys: null, currency: "BRL", now: NOW, ...over });

describe("buildOutflows — estimativa de recorrências", () => {
  it("anexa a estimativa à barra da fatura sem somá-la ao valor confirmado", () => {
    const out = build({ by_invoice: [row(2026, 11, "3928.00")], projected_by_invoice: [projected(2026, 11, "521.40", { approximate: true })] });
    expect(out.hasProjection).toBe(true);
    expect(out.bars[0]).toMatchObject({ key: "2026-11", amount: 3928, projected: { amount: 521.4, count: 7, approximate: true } });
  });

  it("mês só com estimativa ganha barra sem valor confirmado e sem clique, em ordem cronológica", () => {
    const out = build({ by_invoice: [row(2026, 11, "100.00")], projected_by_invoice: [projected(2026, 11, "10.00"), projected(2027, 3, "10.00"), projected(2026, 12, "10.00")] });
    expect(out.bars.map((bar) => bar.key)).toEqual(["2026-11", "2026-12", "2027-03"]);
    expect(out.bars[2]).toMatchObject({ amount: 0, clickable: false, label: "Mar/27" });
  });

  it("duas linhas do mesmo mês somam em vez de a última vencer", () => {
    const out = build({ by_invoice: [row(2026, 11, "100.00")], projected_by_invoice: [projected(2026, 11, "10.00", { count: 2 }), projected(2026, 11, "5.00", { count: 1, approximate: true })] });
    expect(out.bars[0].projected).toMatchObject({ amount: 15, count: 3, approximate: true });
  });

  it("não calculada (null/ausente) ou em outra moeda não desenha estimativa", () => {
    expect(build({ by_invoice: [row(2026, 11, "100.00")], projected_by_invoice: null }).hasProjection).toBe(false);
    expect(build({ by_invoice: [row(2026, 11, "100.00")] }).hasProjection).toBe(false);
    expect(build({ by_invoice: [row(2026, 11, "100.00")], projected_by_invoice: [projected(2026, 11, "9.00", { amount_currency: "EUR" })] }).hasProjection).toBe(false);
  });

  it("a visão por semanas nunca tem estimativa", () => {
    const out = buildOutflows({ mode: "weeks", summary: { breakdown: { by_week: [{ week_start: "2026-10-05", amount: "10.00", amount_currency: "BRL" }], projected_by_invoice: [projected(2026, 11, "9.00")] } }, ladder: null, selectedKeys: [], currency: "BRL", now: NOW });
    expect(out.kind).toBe("weeks");
    expect(out.hasProjection).toBeUndefined();
  });

  it("barras de semana são clicáveis, carregam o intervalo e escurecem as não marcadas", () => {
    const summary = { breakdown: { by_week: [{ week_start: "2026-10-05", amount: "10.00", amount_currency: "BRL" }, { week_start: "2026-10-12", amount: "20.00", amount_currency: "BRL" }] } };
    const all = buildOutflows({ mode: "weeks", summary, ladder: null, selectedKeys: [], currency: "BRL", now: NOW });
    expect(all.bars.map((b) => [b.from, b.to, b.clickable, b.selected])).toEqual([["2026-10-05", "2026-10-11", true, true], ["2026-10-12", "2026-10-18", true, true]]);
    const one = buildOutflows({ mode: "weeks", summary, ladder: null, selectedKeys: [], selectedWeek: "2026-10-12", currency: "BRL", now: NOW });
    expect(one.bars.map((b) => b.selected)).toEqual([false, true]);
  });

  it("com a escada, as semanas vêm dela (o resumo já está recortado numa semana)", () => {
    const ladder = { breakdown: { by_week: [{ week_start: "2026-10-05", amount: "10.00", amount_currency: "BRL" }, { week_start: "2026-10-12", amount: "20.00", amount_currency: "BRL" }] } };
    const summary = { breakdown: { by_week: [{ week_start: "2026-10-12", amount: "20.00", amount_currency: "BRL" }] } };
    expect(buildOutflows({ mode: "weeks", summary, ladder, selectedKeys: [], selectedWeek: "2026-10-12", currency: "BRL", now: NOW }).bars).toHaveLength(2);
  });
});
