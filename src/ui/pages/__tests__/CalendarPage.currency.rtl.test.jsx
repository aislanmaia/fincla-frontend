/** @vitest-environment jsdom */

/**
 * #315 — o Calendário escrevia "R$" nos totais e nos chips com qualquer moeda base:
 * o formatador era um `Intl.NumberFormat(..., "BRL")` de módulo. Os totais do mês e
 * do dia vão na base da organização; o chip de cada lançamento, na moeda DELE.
 *
 * Base, lançamentos e ajustes vêm pelo caminho de verdade (axios → MSW): nenhum hook
 * nem adapter mockado — só o roteador, que a página lê para o estado no URL.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

import { CalendarPage } from "../CalendarPage.jsx";

const ORG = "66666666-6666-4666-8666-666666666666";
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let baseCurrency;
let rows;
let orgDelayMs;
const tx = (id, value, currency, description) => ({
  id, type: "expense", description, value: { amount: value, currency },
  date: `${today}T12:00:00`, paid_at: `${today}T12:00:00`, status: "paid", payment_method: "pix", tags: {},
});

const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, async () => {
    if (orgDelayMs) await delay(orgDelayMs);
    return HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency });
  }),
  http.get("*/v1/transactions", () =>
    HttpResponse.json({ data: rows, pagination: { page: 1, limit: 100, total: rows.length, has_next: false } }),
  ),
  http.get("*/v1/balance-adjustments", () => HttpResponse.json([])),
  http.get("*", () => HttpResponse.json({ detail: "fora do escopo" }, { status: 503 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
beforeEach(() => {
  baseCurrency = "USD";
  orgDelayMs = 0;
  rows = [tx(1, "123.45", "USD", "Mercado")];
});

const text = () => document.body.textContent ?? "";
// `textContent` cru: `toHaveTextContent` normaliza o U+00A0 do Intl para espaço comum.
const kpi = (id) => screen.getByTestId(`kpi-value-${id}`).textContent;

describe("Calendário — moeda base nos totais, moeda da linha nos chips (#315)", () => {
  it("base USD: KPIs, saldo do dia e chip em US$, nenhum R$", async () => {
    render(<CalendarPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(kpi("saidas")).toBe("US$\u00a0123,45"));
    expect(kpi("saldo")).toBe("-US$\u00a0123,45");
    expect(text()).not.toMatch(/R\$/);
  });

  it("o chip do lançamento sai na moeda DELE, não na base", async () => {
    rows = [tx(1, "80.00", "EUR", "Hotel")];
    render(<CalendarPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(text()).toContain("Hotel€\u00a080,00"));
  });

  it("base BRL: a saída continua a do Intl de sempre", async () => {
    baseCurrency = "BRL";
    rows = [tx(1, "123.45", "BRL", "Mercado")];
    render(<CalendarPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(kpi("saidas")).toBe("R$\u00a0123,45"));
    expect(text()).toContain("MercadoR$\u00a0123,45");
  });

  it("enquanto a base não chega, os totais são travessão — nunca R$", async () => {
    orgDelayMs = 300;
    render(<CalendarPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(text()).toContain("MercadoUS$\u00a0123,45"));
    expect(kpi("saidas")).toBe("—");
    expect(text()).not.toMatch(/R\$/);
    await waitFor(() => expect(kpi("saidas")).toBe("US$\u00a0123,45"));
  });
});
