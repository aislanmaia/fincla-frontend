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
      http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => new URL(request.url).searchParams.get("empty_as_null") === "true"
        ? HttpResponse.json(null) : HttpResponse.json({ detail: "missing opt in" }, { status: 400 })),
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
      http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => new URL(request.url).searchParams.get("empty_as_null") === "true"
        ? HttpResponse.json(null) : HttpResponse.json({ detail: "missing opt in" }, { status: 400 })),
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


describe("useCardHubData — cancelar a mudança agendada", () => {
  it("manda o DELETE do cartão selecionado e troca o cartão pelo que o backend devolveu", async () => {
    const scheduled = { ...card(1, 3, 10), cycle_rules: [
      { effective_year: 1900, effective_month: 1, due_day: 10, closing_day: 3 },
      { effective_year: 2099, effective_month: 3, due_day: 20, closing_day: 13 },
    ] };
    const cancelled = { ...scheduled, cycle_rules: [scheduled.cycle_rules[0]] };
    const deletes = [];
    server.use(
      http.get("*/v1/credit-cards", () => HttpResponse.json([scheduled])),
      http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [row("111.00")] })),
      http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => new URL(request.url).searchParams.get("empty_as_null") === "true"
        ? HttpResponse.json(null) : HttpResponse.json({ detail: "missing opt in" }, { status: 400 })),
      http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json({ monthly_breakdown: [], insights: [] })),
      http.delete("*/v1/credit-cards/:id/scheduled-cycle", ({ params, request }) => {
        deletes.push({ id: params.id, org: new URL(request.url).searchParams.get("organization_id") });
        return HttpResponse.json(cancelled);
      }),
    );
    const { result } = renderHook(() => useCardHubData({ organizationId: ORG, enabled: true, refreshToken: 0 }));
    await waitFor(() => expect(result.current.selectedCard?.cycle_rules).toHaveLength(2));

    await act(async () => { await result.current.cancelScheduledCycle(); });

    expect(deletes).toEqual([{ id: "1", org: ORG }]);
    expect(result.current.selectedCard.cycle_rules).toHaveLength(1);
  });
});


describe("useCardHubData — cancelar quando já foi cancelada em outro lugar", () => {
  it("409 NO_SCHEDULED_CYCLE_CHANGE busca os cartões de novo em vez de travar", async () => {
    const stale = { ...card(1, 3, 10), cycle_rules: [
      { effective_year: 1900, effective_month: 1, due_day: 10, closing_day: 3 },
      { effective_year: 2099, effective_month: 3, due_day: 20, closing_day: 13 },
    ] };
    const fresh = { ...stale, cycle_rules: [stale.cycle_rules[0]] };
    let lists = 0;
    server.use(
      http.get("*/v1/credit-cards", () => { lists += 1; return HttpResponse.json(lists === 1 ? [stale] : [fresh]); }),
      http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [row("111.00")] })),
      http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => new URL(request.url).searchParams.get("empty_as_null") === "true"
        ? HttpResponse.json(null) : HttpResponse.json({ detail: "missing opt in" }, { status: 400 })),
      http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json({ monthly_breakdown: [], insights: [] })),
      http.delete("*/v1/credit-cards/:id/scheduled-cycle", () => HttpResponse.json(
        { detail: { error: "NO_SCHEDULED_CYCLE_CHANGE", message: "nothing scheduled", type: "conflict" } }, { status: 409 })),
    );
    const { result } = renderHook(() => useCardHubData({ organizationId: ORG, enabled: true, refreshToken: 0 }));
    await waitFor(() => expect(result.current.selectedCard?.cycle_rules).toHaveLength(2));

    await act(async () => { await result.current.cancelScheduledCycle(); });

    expect(result.current.selectedCard.cycle_rules).toHaveLength(1);
  });

  it("outro erro (fatura paga) continua subindo para o aviso", async () => {
    const stale = { ...card(1, 3, 10), cycle_rules: [
      { effective_year: 1900, effective_month: 1, due_day: 10, closing_day: 3 },
      { effective_year: 2099, effective_month: 3, due_day: 20, closing_day: 13 },
    ] };
    server.use(
      http.get("*/v1/credit-cards", () => HttpResponse.json([stale])),
      http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [row("111.00")] })),
      http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => new URL(request.url).searchParams.get("empty_as_null") === "true"
        ? HttpResponse.json(null) : HttpResponse.json({ detail: "missing opt in" }, { status: 400 })),
      http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json({ monthly_breakdown: [], insights: [] })),
      http.delete("*/v1/credit-cards/:id/scheduled-cycle", () => HttpResponse.json(
        { detail: { error: "PAID_INVOICE_IMMUTABLE", message: "x", type: "business_logic" } }, { status: 409 })),
    );
    const { result } = renderHook(() => useCardHubData({ organizationId: ORG, enabled: true, refreshToken: 0 }));
    await waitFor(() => expect(result.current.selectedCard?.cycle_rules).toHaveLength(2));

    await expect(act(async () => { await result.current.cancelScheduledCycle(); })).rejects.toBeTruthy();

    expect(result.current.selectedCard.cycle_rules).toHaveLength(2);
  });
});
