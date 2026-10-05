import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../test/fakeCardsApi.js";
import { listCreditCardsForUi } from "../creditCardsAdapter.js";

/**
 * Caracterização do caso que a primeira bateria não cobria: a fatura atual REAL
 * existe, mas nem o histórico (que só vai até o mês corrente) nem os compromissos
 * futuros (só parcelas) a enxergam, como uma compra à vista no mês seguinte.
 * Escritos contra o main (caminhada mês a mês) e válidos para a versão sem laço.
 */
let api;
let today;

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  api?.uninstall();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function load(card, invoices, hiddenFromFuture, day) {
  today = day;
  vi.setSystemTime(today);
  api = installFakeCardsApi({ cards: [card], invoices: { [card.id]: invoices }, hiddenFromFuture, today });
  return (await listCreditCardsForUi("org-1")).cards[0];
}

const inv = (year, month, status, total, extra = {}) =>
  fakeInvoice({ year, month, status, total, items: [fakeItem({ id: year * 100 + month, year, month, amount: total })], ...extra });

describe("fatura atual que só o detalhe do mês revela", () => {
  it("cartão sem fechamento, ciclo de outubro já fechado: a fatura de novembro (só à vista) é a atual", async () => {
    // Reproduz o cartão 1 do demo: vencimento 10, sem dia de fechamento, hoje 04/10.
    const ui = await load(
      fakeCard({ closing_day: null, due_day: 10 }),
      [
        inv(2026, 10, "open", 65, { closingDate: "2026-10-03" }),
        inv(2026, 11, "open", 35, { closingDate: "2026-11-03" }),
      ],
      ["2026-11"],
      new Date(2026, 9, 4, 12),
    );
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
    expect(ui.analytics.currentInvoice.total_amount).toBe(35);
    expect(ui.itens.map((i) => i.id)).toEqual([202611]);
    expect(ui.faturas.find((f) => f.atual)).toMatchObject({ id: "2026-11", val: 35 });
  });

  it("depois do fechamento, a âncora é novembro e a fatura (só à vista) existe", async () => {
    const ui = await load(
      fakeCard({ closing_day: 10, due_day: 20 }),
      [inv(2026, 10, "open", 300, { closingDate: "2026-10-10" }), inv(2026, 11, "open", 42, { closingDate: "2026-11-10" })],
      ["2026-11"],
      new Date(2026, 9, 15, 12),
    );
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
    expect(ui.faturas.find((f) => f.atual)).toMatchObject({ id: "2026-11", val: 42 });
  });

  it("atual paga e a seguinte (só à vista) existe: avança para ela", async () => {
    const ui = await load(
      fakeCard(),
      [inv(2026, 10, "paid", 300), inv(2026, 11, "open", 19)],
      ["2026-11"],
      new Date(2026, 9, 15, 12),
    );
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
    expect(ui.faturas.find((f) => f.atual)).toMatchObject({ id: "2026-11", val: 19 });
  });
});
