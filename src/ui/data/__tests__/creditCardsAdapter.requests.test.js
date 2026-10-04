import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../test/fakeCardsApi.js";
import {
  listCreditCardsBasicForUi,
  listCreditCardsForUi,
  loadCreditCardDetailForUi,
} from "../creditCardsAdapter.js";

/**
 * Quantas chamadas custa achar a fatura atual. As escolhas de QUAL fatura é a
 * atual estão em `creditCardsAdapter.characterization.test.js`; aqui o que se
 * prende é o custo: no máximo um detalhe de fatura e nunca um 404 de passagem.
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

const item = (id, year, month) => fakeItem({ id, year, month });
const inv = (year, month, status, extra = {}) =>
  fakeInvoice({ year, month, status, items: [item(year * 100 + month, year, month)], ...extra });

async function detailFor(card, invoices, extra = {}) {
  api = installFakeCardsApi({ cards: [card], invoices: { [card.id]: invoices }, today: TODAY, ...extra });
  const { rawCards } = await listCreditCardsBasicForUi("org-1");
  api.calls.length = 0;
  const ui = await loadCreditCardDetailForUi(rawCards[0], "org-1");
  return { ui, calls: api.calls };
}

const invoiceCalls = (calls) => calls.filter((c) => /\/invoices\/\d{4}\/\d+$/.test(c.path));

describe("custo da fatura atual", () => {
  it.each([
    ["aberta com fechamento futuro", fakeCard(), [inv(2026, 10, "open")]],
    ["paga, avança para a seguinte", fakeCard(), [inv(2026, 10, "paid"), inv(2026, 11, "open")]],
    ["paga sem seguinte", fakeCard(), [inv(2026, 10, "paid")]],
    [
      "aberta vencida, avança",
      fakeCard({ closing_day: null, due_day: 20 }),
      [inv(2026, 10, "open", { closingDate: "2026-10-13" }), inv(2026, 11, "open", { closingDate: "2026-11-13" })],
    ],
    ["fechada não paga", fakeCard(), [inv(2026, 10, "closed"), inv(2026, 11, "open")]],
    ["só parcelas no mês seguinte", fakeCard(), [inv(2026, 11, "open")]],
  ])("%s: histórico + futuro + exatamente 1 detalhe, nenhum 404", async (_name, card, invoices) => {
    const { calls } = await detailFor(card, invoices);
    expect(invoiceCalls(calls)).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(calls.filter((c) => c.status >= 400)).toEqual([]);
  });

  it("cartão sem fatura: nenhum detalhe pedido (sintético), nenhum 404", async () => {
    const { calls } = await detailFor(fakeCard(), []);
    expect(invoiceCalls(calls)).toEqual([]);
    expect(calls.map((c) => c.path).sort()).toEqual(
      ["/credit-cards/1/future-commitments", "/credit-cards/1/invoices/history"].sort(),
    );
  });

  it("aberta vencida sem a seguinte: sintético do mês seguinte sem pedir nenhuma fatura", async () => {
    const { calls, ui } = await detailFor(fakeCard({ closing_day: null, due_day: 20 }), [
      inv(2026, 10, "open", { closingDate: "2026-10-13" }),
    ]);
    expect(invoiceCalls(calls)).toEqual([]);
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
  });

  it("não cresce com o histórico: seis meses de faturas pagas custam o mesmo", async () => {
    const { calls } = await detailFor(fakeCard(), [
      inv(2026, 5, "paid"),
      inv(2026, 6, "paid"),
      inv(2026, 7, "paid"),
      inv(2026, 8, "paid"),
      inv(2026, 9, "paid"),
      inv(2026, 10, "paid"),
      inv(2026, 11, "open"),
    ]);
    expect(invoiceCalls(calls)).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });
});

describe("dado dessincronizado: o fato real corrige a dedução", () => {
  it("histórico diz aberta, o detalhe diz paga: recalcula e segue para a seguinte", async () => {
    const { calls, ui } = await detailFor(
      fakeCard(),
      [inv(2026, 10, "paid"), inv(2026, 11, "open")],
      { historyStatus: { "2026-10": "open" } },
    );
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
    expect(invoiceCalls(calls).map((c) => c.path.slice(-7))).toEqual(["2026/10", "2026/11"]);
  });

  it("compromisso futuro sem fatura de verdade: um 404 e cai no sintético, sem andar meses", async () => {
    const { calls, ui } = await detailFor(fakeCard(), [], { breakdownTotals: { "2026-10": 77 } });
    expect(invoiceCalls(calls)).toHaveLength(1);
    expect(calls.filter((c) => c.status === 404)).toHaveLength(1);
    expect(ui.analytics.currentInvoice.total_amount).toBe(77);
  });
});

describe("listas", () => {
  it("lista básica: uma chamada, sem detalhe", async () => {
    api = installFakeCardsApi({
      cards: [fakeCard({ id: 1 }), fakeCard({ id: 2 }), fakeCard({ id: 3 })],
      today: TODAY,
    });
    const { cards } = await listCreditCardsBasicForUi("org-1");
    expect(api.calls.map((c) => c.path)).toEqual(["/credit-cards"]);
    expect(cards.map((c) => c.detailLoaded)).toEqual([false, false, false]);
    expect(cards[0]).toMatchObject({ limite: 5000, disponivel: 4000, dig: "1111" });
  });

  it("lista completa (consultor): 3 chamadas por cartão, sem fan-out de meses nem consolidado", async () => {
    const cards = [fakeCard({ id: 1 }), fakeCard({ id: 2 }), fakeCard({ id: 3 })];
    api = installFakeCardsApi({
      cards,
      invoices: Object.fromEntries(cards.map((c) => [c.id, [inv(2026, 10, "open")]])),
      today: TODAY,
    });
    await listCreditCardsForUi("org-1");
    expect(api.calls).toHaveLength(1 + 3 * 3);
    expect(api.calls.filter((c) => c.status >= 400)).toEqual([]);
  });
});
