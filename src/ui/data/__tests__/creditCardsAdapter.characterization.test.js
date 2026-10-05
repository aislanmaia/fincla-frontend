import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../test/fakeCardsApi.js";
import { listCreditCardsForUi } from "../creditCardsAdapter.js";

/**
 * Caracterização de QUAL fatura a tela de Cartões trata como "atual".
 *
 * Escrito antes do refactor que tirou a caminhada mês a mês: estes testes
 * passaram no código antigo e não podem ser editados para passar no novo.
 * Hoje fixo: 15/10/2026.
 */
const TODAY = new Date(2026, 9, 15, 12, 0, 0);

let api;

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  api?.uninstall();
  api = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const item = (id, year, month, extra = {}) => fakeItem({ id, year, month, ...extra });

async function loadFirstCard({ card = fakeCard(), invoices, breakdownTotals }) {
  api = installFakeCardsApi({ cards: [card], invoices: { [card.id]: invoices }, breakdownTotals, today: TODAY });
  const result = await listCreditCardsForUi("org-1");
  return result.cards[0];
}

const view = (ui) => ({
  atual: ui.faturas.filter((f) => f.atual).map((f) => ({ id: f.id, status: f.status, val: f.val, pago: f.pago })),
  faturas: ui.faturas.map((f) => `${f.id}:${f.status}`),
  currentMonth: ui.analytics.currentInvoice.month,
  currentStatus: ui.analytics.currentInvoice.status,
  itens: ui.itens.map((i) => i.id),
  limite: ui.limite,
  disponivel: ui.disponivel,
});

describe("fatura atual da tela de Cartões (caracterização)", () => {
  it("fatura do mês aberta e com fechamento futuro é a atual", async () => {
    const ui = await loadFirstCard({
      invoices: [
        fakeInvoice({ year: 2026, month: 9, status: "paid", total: 200 }),
        fakeInvoice({ year: 2026, month: 10, status: "open", total: 300, items: [item(1, 2026, 10)] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", total: 50, items: [item(2, 2026, 11)] }),
      ],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-10", status: "open", val: 300, pago: false }],
      currentMonth: "2026-10",
      currentStatus: "open",
      itens: [1],
    });
    expect(ui.faturas.map((f) => f.id)).toEqual([
      "2026-9", "2026-10", "2026-11", "2026-12", "2027-1", "2027-2", "2027-3",
    ]);
    expect(ui.faturas.find((f) => f.id === "2026-12")).toMatchObject({ status: null, atual: false });
  });

  it("fatura atual já paga: avança para a seguinte", async () => {
    const ui = await loadFirstCard({
      invoices: [
        fakeInvoice({ year: 2026, month: 10, status: "paid", total: 300, items: [item(1, 2026, 10)] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", total: 80, items: [item(2, 2026, 11)] }),
      ],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-11", status: "open", val: 80, pago: false }],
      currentMonth: "2026-11",
      itens: [2],
    });
    expect(ui.faturas.find((f) => f.id === "2026-10")).toMatchObject({ atual: false, pago: true, status: "paid" });
  });

  it("paga e sem nenhuma fatura depois: fica a própria fatura paga", async () => {
    const ui = await loadFirstCard({
      invoices: [fakeInvoice({ year: 2026, month: 10, status: "paid", total: 300, items: [item(1, 2026, 10)] })],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-10", status: "paid", val: 300, pago: true }],
      currentMonth: "2026-10",
      itens: [1],
    });
  });

  it("aberta com fechamento já passado: avança para a seguinte", async () => {
    // Sem dia de fechamento o app ancora no vencimento (20), mas a fatura
    // fecha 7 dias antes (13), então em 15/10 a de outubro já fechou.
    const ui = await loadFirstCard({
      card: fakeCard({ closing_day: null, due_day: 20 }),
      invoices: [
        fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-13", total: 300, items: [item(1, 2026, 10)] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", closingDate: "2026-11-13", total: 90, items: [item(2, 2026, 11)] }),
      ],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-11", status: "open", val: 90 }],
      currentMonth: "2026-11",
      itens: [2],
    });
  });

  it("aberta com fechamento passado e sem a seguinte: cai no sintético do mês seguinte", async () => {
    const ui = await loadFirstCard({
      card: fakeCard({ closing_day: null, due_day: 20 }),
      invoices: [
        fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-13", total: 300, items: [item(1, 2026, 10)] }),
      ],
      breakdownTotals: { "2026-11": 0 },
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-11", status: "open", val: 0 }],
      currentMonth: "2026-11",
      currentStatus: "open",
      itens: [],
    });
    expect(ui.analytics.currentInvoice.limit_usage_percent).toBe(7);
  });

  it("fechada e não paga: NÃO avança, segue como a atual", async () => {
    const ui = await loadFirstCard({
      invoices: [
        fakeInvoice({ year: 2026, month: 10, status: "closed", total: 300, items: [item(1, 2026, 10)] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", total: 80, items: [item(2, 2026, 11)] }),
      ],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-10", status: "closed", val: 300 }],
      currentMonth: "2026-10",
      currentStatus: "closed",
      itens: [1],
    });
  });

  it("cartão sem nenhuma fatura: sintético do mês de fechamento, com o total do breakdown", async () => {
    const ui = await loadFirstCard({ invoices: [], breakdownTotals: { "2026-10": 0 } });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-10", status: "open", val: 0, pago: false }],
      currentMonth: "2026-10",
      itens: [],
    });
    expect(ui.analytics.currentInvoice.items_count).toBe(0);
  });

  it("sem fatura, mas o breakdown já projeta valor no mês: o sintético leva esse total", async () => {
    const ui = await loadFirstCard({ invoices: [], breakdownTotals: { "2026-10": 123 } });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-10", status: "open", val: 123 }],
      currentMonth: "2026-10",
      itens: [],
    });
  });

  it("parcelas só no mês seguinte: a fatura de novembro é a atual", async () => {
    const ui = await loadFirstCard({
      invoices: [fakeInvoice({ year: 2026, month: 11, status: "open", total: 150, items: [item(7, 2026, 11, { installment: 1, total: 3 })] })],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-11", status: "open", val: 150 }],
      currentMonth: "2026-11",
      itens: [7],
    });
    expect(ui.parcelas_ativas).toHaveLength(1);
  });

  it("depois do fechamento do mês, a âncora é o mês seguinte", async () => {
    const ui = await loadFirstCard({
      card: fakeCard({ closing_day: 10, due_day: 20 }),
      invoices: [
        fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-10", total: 300, items: [item(1, 2026, 10)] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", closingDate: "2026-11-10", total: 40, items: [item(2, 2026, 11)] }),
      ],
    });
    expect(view(ui)).toMatchObject({
      atual: [{ id: "2026-11", status: "open", val: 40 }],
      currentMonth: "2026-11",
      itens: [2],
    });
  });

  it("limites e dados do cartão vêm da lista, não da fatura", async () => {
    const ui = await loadFirstCard({
      card: fakeCard({ credit_limit: { amount: "8000.00", currency: "BRL" }, available_limit: { amount: "6500.00", currency: "BRL" } }),
      invoices: [fakeInvoice({ year: 2026, month: 10, status: "open", total: 300, items: [item(1, 2026, 10)] })],
    });
    expect(ui).toMatchObject({ limite: 8000, disponivel: 6500, vencimento: 20, fechamento: 20, dig: "1111" });
  });
});
