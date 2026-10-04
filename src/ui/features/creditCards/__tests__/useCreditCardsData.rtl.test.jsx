/** @vitest-environment jsdom */

import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../../test/fakeCardsApi.js";
import { useCreditCardsData } from "../useCreditCardsData.js";

const TODAY = new Date(2026, 9, 15, 12, 0, 0);

let api;

function setup(cardCount = 3) {
  const cards = Array.from({ length: cardCount }, (_, i) =>
    fakeCard({ id: i + 1, last4: String(1111 * (i + 1)), description: `Cartão ${i + 1}` }),
  );
  const invoices = Object.fromEntries(
    cards.map((c) => [
      c.id,
      [
        fakeInvoice({
          year: 2026,
          month: 10,
          status: "open",
          total: 100 * c.id,
          items: [fakeItem({ id: c.id * 10, year: 2026, month: 10 })],
        }),
      ],
    ]),
  );
  api = installFakeCardsApi({ cards, invoices, today: TODAY });
  return cards;
}

const cardsCalls = () => api.calls.filter((c) => c.path.startsWith("/credit-cards"));
const detailPaths = (cardId) => api.calls.filter((c) => c.path.startsWith(`/credit-cards/${cardId}/`)).map((c) => c.path);

const renderData = (props = {}, options = {}) =>
  renderHook((p) => useCreditCardsData({ organizationId: "org-1", enabled: true, ...p }), {
    initialProps: props,
    ...options,
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  api?.uninstall();
  api = null;
  vi.useRealTimers();
});

describe("useCreditCardsData: carga com custo fixo", () => {
  it("busca a lista e o detalhe só do cartão selecionado, sem 404", async () => {
    setup(3);
    const { result } = renderData();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cards.map((c) => [c.id, c.detailLoaded])).toEqual([
      ["1", true],
      ["2", false],
      ["3", false],
    ]);
    expect(cardsCalls().map((c) => c.path)).toEqual([
      "/credit-cards",
      "/credit-cards/1/invoices/history",
      "/credit-cards/1/future-commitments",
      "/credit-cards/1/invoices/2026/10",
    ]);
    expect(api.calls.filter((c) => c.status >= 400)).toEqual([]);
    expect(result.current.cards[0].itens).toHaveLength(1);
  });

  it("a carga custa o mesmo com 1 e com 8 cartões", async () => {
    setup(1);
    const one = renderData();
    await waitFor(() => expect(one.result.current.isLoading).toBe(false));
    const callsWithOne = api.calls.length;
    one.unmount();
    api.uninstall();

    setup(8);
    const many = renderData();
    await waitFor(() => expect(many.result.current.isLoading).toBe(false));
    expect(api.calls.length).toBe(callsWithOne);
  });

  it("carrega o cartão indicado em selectedCardId, não o primeiro", async () => {
    setup(3);
    const { result } = renderData({ selectedCardId: "3" });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.cards.map((c) => c.detailLoaded)).toEqual([false, false, true]);
    expect(detailPaths(1)).toEqual([]);
    expect(detailPaths(3)).toHaveLength(3);
  });

  it("sob StrictMode a carga não duplica nenhuma requisição", async () => {
    setup(3);
    const { result } = renderData({}, { wrapper: StrictMode });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const urls = api.calls.map((c) => c.path);
    expect(new Set(urls).size).toBe(urls.length);
    expect(cardsCalls()).toHaveLength(4);
  });
});

describe("useCreditCardsData: detalhe sob demanda e cache", () => {
  it("ensureCardDetail busca só o cartão pedido e reaproveita na segunda vez", async () => {
    setup(3);
    const { result } = renderData();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    api.calls.length = 0;

    let detailed;
    await act(async () => {
      detailed = await result.current.ensureCardDetail("2");
    });
    expect(detailed.detailLoaded).toBe(true);
    expect(detailed.itens).toHaveLength(1);
    expect(api.calls.map((c) => c.path).sort()).toEqual(
      [
        "/credit-cards/2/future-commitments",
        "/credit-cards/2/invoices/2026/10",
        "/credit-cards/2/invoices/history",
      ].sort(),
    );
    expect(result.current.cards.find((c) => c.id === "2").detailLoaded).toBe(true);

    api.calls.length = 0;
    await act(async () => {
      await result.current.ensureCardDetail("2");
      await result.current.ensureCardDetail("1");
    });
    expect(api.calls).toEqual([]);
  });

  it("duas chamadas simultâneas para o mesmo cartão viram uma busca só", async () => {
    setup(3);
    const { result } = renderData();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    api.calls.length = 0;

    await act(async () => {
      await Promise.all([result.current.ensureCardDetail("3"), result.current.ensureCardDetail("3")]);
    });
    expect(detailPaths(3)).toHaveLength(3);
  });

  it("mutação recarrega lista + selecionado e invalida o cache dos demais", async () => {
    setup(3);
    const { result } = renderData();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.ensureCardDetail("2");
    });
    api.calls.length = 0;

    await act(async () => {
      await result.current.markInvoicePaid({
        cardId: 1,
        year: 2026,
        month: 10,
        organizationId: "org-1",
      });
    });

    const paths = api.calls.map((c) => `${c.method} ${c.path}`);
    expect(paths.filter((p) => p.startsWith("GET /credit-cards")).sort()).toEqual(
      [
        "GET /credit-cards",
        "GET /credit-cards/1/future-commitments",
        // Paga e sem seguinte: confirma novembro (404, "ainda sem lançamentos") e mostra a paga.
        "GET /credit-cards/1/invoices/2026/10",
        "GET /credit-cards/1/invoices/2026/11",
        "GET /credit-cards/1/invoices/history",
      ].sort(),
    );
    expect(result.current.cards.map((c) => c.detailLoaded)).toEqual([true, false, false]);
    expect(result.current.cards[0].faturas.find((f) => f.id === "2026-10")).toMatchObject({ status: "paid" });

    api.calls.length = 0;
    await act(async () => {
      await result.current.ensureCardDetail("2");
    });
    expect(detailPaths(2)).toHaveLength(3);
  });

  it("recarrega a lista quando transactionsRefreshToken muda", async () => {
    setup(2);
    const { result, rerender } = renderData({ transactionsRefreshToken: 0 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    api.calls.length = 0;

    rerender({ transactionsRefreshToken: 1 });
    await waitFor(() => expect(cardsCalls()).toHaveLength(4));
    expect(cardsCalls()[0].path).toBe("/credit-cards");
  });

  it("sem organização ou desabilitado, não chama a API", async () => {
    setup(2);
    const { result } = renderData({ enabled: false });
    await act(async () => {});
    expect(result.current.cards).toEqual([]);
    expect(api.calls).toEqual([]);
  });
});
