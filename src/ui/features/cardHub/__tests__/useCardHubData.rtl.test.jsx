/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { useCardHubData } from "../useCardHubData.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const m = (a) => ({ amount: a, currency: "BRL" });
const card = (id, closing, due) => ({
  id, public_id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, organization_id: ORG, last4: String(1000 + id), brand: "Visa", due_day: due, closing_day: closing,
  description: `C${id}`, color: null, notes: null, currency: "BRL",
  credit_limit: m("1000.00"), available_limit: m("900.00"), used_limit: m("100.00"), limit_usage_percent: 10,
});
const row = (total) => ({ year: 2026, month: 9, month_name: "", total_amount: m(total), status: "paid", items_count: 2, top_category: null });

describe("useCardHubData — troca de cartão", () => {
  it("nunca há um render com o detalhe de um cartão e o closing/due do outro", async () => {
    server.use(
      http.get("*/v1/credit-cards", () => HttpResponse.json([card(1, 10, 5), card(2, 20, 25)])),
      http.get("*/v1/credit-cards/:id/invoices/history", async ({ params }) => {
        if (params.id === "2") await new Promise((r) => setTimeout(r, 60));
        return HttpResponse.json({ card_id: Number(params.id), monthly_data: [row(params.id === "1" ? "111.00" : "222.00")] });
      }),
      http.get("*/v1/credit-cards/:id/invoices/current", () => HttpResponse.json({ detail: "x" }, { status: 404 })),
      http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json({ monthly_breakdown: [], insights: [] })),
    );

    const renders = [];
    const { result } = renderHook(() => {
      const hub = useCardHubData({ organizationId: ORG, enabled: true, refreshToken: 0 });
      renders.push({
        selected: hub.selectedCardId,
        due: hub.selectedCard?.due_day,
        totals: hub.invoiceCards.filter((c) => c.total !== null).map((c) => c.total),
        detailCardId: hub.detail.cardId,
        loading: hub.detail.loading,
        uiDig: hub.uiCards.find((c) => c.cardId === hub.selectedCardId)?.faturas.map((f) => f.val) ?? [],
      });
      return hub;
    });
    await waitFor(() => expect(result.current.invoiceCards.length).toBeGreaterThan(0));
    expect(result.current.invoiceCards.some((c) => c.total === 111)).toBe(true);

    act(() => result.current.selectCard(2));
    await waitFor(() => expect(result.current.invoiceCards.some((c) => c.total === 222)).toBe(true));

    for (const r of renders.filter((x) => x.selected === 2)) {
      // dado do cartão 1 jamais aparece com o cartão 2 selecionado
      expect(r.totals).not.toContain(111);
      expect(r.uiDig).not.toContain(111);
      if (r.totals.length > 0) expect(r.loading).toBe(false);
    }
    // e o intervalo de carregamento existiu (a troca não foi instantânea com dado velho)
    expect(renders.some((x) => x.selected === 2 && x.totals.length === 0 && x.loading)).toBe(true);
  });
});


describe("useCardHubData — StrictMode", () => {
  it("compartilha apenas a lista inicial em voo e mantém refetch explícito", async () => {
    let lists = 0;
    server.use(
      http.get("*/v1/credit-cards", () => { lists += 1; return HttpResponse.json([card(1, 10, 5)]); }),
      http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [row("111.00")] })),
      http.get("*/v1/credit-cards/:id/invoices/current", () => HttpResponse.json({ detail: "x" }, { status: 404 })),
      http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json({ monthly_breakdown: [], insights: [] })),
    );
    const { result, rerender } = renderHook(({ refreshToken }) => useCardHubData({ organizationId: ORG, refreshToken }),
      { initialProps: { refreshToken: 0 }, wrapper: StrictMode });
    await waitFor(() => expect(result.current.invoiceCards.length).toBeGreaterThan(0));
    expect(lists).toBe(1);
    rerender({ refreshToken: 1 });
    await waitFor(() => expect(lists).toBe(2));
  });
});
