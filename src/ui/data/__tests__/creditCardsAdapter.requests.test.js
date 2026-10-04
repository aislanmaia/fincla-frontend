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
 * prende é o custo: no máximo uma consulta por mês confirmado e, no pior caso, um único 404.
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
  if (extra.today) vi.setSystemTime(extra.today);
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
    [
      "aberta vencida, avança",
      fakeCard({ closing_day: null, due_day: 20 }),
      [inv(2026, 10, "open", { closingDate: "2026-10-13" }), inv(2026, 11, "open", { closingDate: "2026-11-13" })],
    ],
    ["fechada não paga", fakeCard(), [inv(2026, 10, "closed"), inv(2026, 11, "open")]],
  ])("%s: histórico + futuro + exatamente 1 detalhe, nenhum 404", async (_name, card, invoices) => {
    const { calls } = await detailFor(card, invoices);
    expect(invoiceCalls(calls)).toHaveLength(1);
    expect(calls).toHaveLength(3);
    expect(calls.filter((c) => c.status >= 400)).toEqual([]);
  });

  it("só parcelas no mês seguinte: o mês-âncora é confirmado (um 404) e a de novembro é a atual", async () => {
    const { calls, ui } = await detailFor(fakeCard(), [inv(2026, 11, "open")]);
    expect(invoiceCalls(calls).map((c) => [c.path.slice(-7), c.status])).toEqual([
      ["2026/10", 404],
      ["2026/11", 200],
    ]);
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
  });

  it("mês-âncora invisível para histórico e futuro, com fato conhecido adiante: o âncora é confirmado", async () => {
    // Outubro só tem compra à vista (nenhuma fonte o vê); novembro tem parcelas (futuro o vê).
    const { calls, ui } = await detailFor(
      fakeCard({ closing_day: 20, due_day: 25 }),
      [inv(2026, 10, "open", { closingDate: "2026-10-20" }), inv(2026, 11, "open", { closingDate: "2026-11-20" })],
      { hiddenFromHistory: ["2026-10"], hiddenFromFuture: ["2026-10"] },
    );
    expect(ui.analytics.currentInvoice.month).toBe("2026-10");
    expect(invoiceCalls(calls).map((c) => [c.path.slice(-7), c.status])).toEqual([["2026/10", 200]]);
  });

  it("erro de servidor na consulta NÃO vira \"sem fatura\": a carga falha em vez de mostrar R$ 0,00", async () => {
    api = installFakeCardsApi({ cards: [fakeCard()], invoices: { 1: [inv(2026, 10, "open")] }, failInvoiceWith: 500, today: TODAY });
    const { rawCards } = await listCreditCardsBasicForUi("org-1");
    await expect(loadCreditCardDetailForUi(rawCards[0], "org-1")).rejects.toBeTruthy();
  });

  it("paga e a seguinte ainda vazia: confirma o mês seguinte (um 404) e mostra a paga", async () => {
    const { calls, ui } = await detailFor(fakeCard(), [inv(2026, 10, "paid")]);
    expect(invoiceCalls(calls).map((c) => [c.path.slice(-7), c.status])).toEqual([
      ["2026/11", 404],
      ["2026/10", 200],
    ]);
    expect(ui.analytics.currentInvoice.status).toBe("paid");
  });

  it("cartão sem fatura: UMA confirmação (404) e cai no sintético, sem andar meses", async () => {
    const { calls } = await detailFor(fakeCard(), []);
    expect(invoiceCalls(calls)).toHaveLength(1);
    expect(calls.filter((c) => c.status >= 400)).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it("aberta vencida sem a seguinte: uma confirmação do mês seguinte e sintético dele", async () => {
    const { calls, ui } = await detailFor(fakeCard({ closing_day: null, due_day: 20 }), [
      inv(2026, 10, "open", { closingDate: "2026-10-13" }),
    ]);
    expect(invoiceCalls(calls).map((c) => [c.path.slice(-7), c.status])).toEqual([["2026/11", 404]]);
    expect(ui.analytics.currentInvoice.month).toBe("2026-11");
  });

  it("fatura do mês seguinte invisível para histórico e futuro (só à vista): 1 consulta a acha", async () => {
    const { calls, ui } = await detailFor(
      fakeCard({ closing_day: null, due_day: 10 }),
      [inv(2026, 10, "open", { closingDate: "2026-10-03" }), inv(2026, 11, "open", { closingDate: "2026-11-03" })],
      { hiddenFromFuture: ["2026-11"], today: new Date(2026, 9, 4, 12) },
    );
    expect(invoiceCalls(calls).map((c) => [c.path.slice(-7), c.status])).toEqual([["2026/11", 200]]);
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
