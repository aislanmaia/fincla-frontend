/** @vitest-environment jsdom */

/**
 * #315 — Planejado × Realizado escrevia "R$" com qualquer moeda base: o formatador
 * era um `Intl.NumberFormat(..., "BRL")` de módulo. Os valores do plano são da moeda
 * base da organização (#284). A base e o plano vêm pelo caminho de verdade (axios →
 * MSW), sem dublê de hook.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";

import { PlannedVsActualPage } from "../PlannedVsActualPage.jsx";

const ORG = "55555555-5555-4555-8555-555555555555";
let baseCurrency;
let orgDelayMs;

const m = (amount) => ({ amount, currency: baseCurrency });
const plan = () => ({
  year: 2026, month: 11, has_plan: true, status: "active", notes: null,
  planned_income: m("7000.00"), planned_expense: m("4500.00"),
  actual_income: m("7500.00"), actual_expense: m("5230.00"),
  items: [
    { tag_id: "t1", tag_name: "Food & Groceries", kind: "expense", planned: m("1200.00"), actual: m("1560.00"), variance: m("360.00"), in_plan: true },
    { tag_id: "t3", tag_name: "Transport", kind: "expense", planned: m("600.00"), actual: m("480.00"), variance: m("-120.00"), in_plan: true },
  ],
});

const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, async () => {
    if (orgDelayMs) await delay(orgDelayMs);
    return HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency });
  }),
  http.get("*/v1/monthly-plans/:y/:m", () => HttpResponse.json(plan())),
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
});

const text = () => document.body.textContent ?? "";

describe("Planejado × Realizado — valores na moeda base (#315)", () => {
  it("base USD: cartões e categorias em US$, nenhum R$", async () => {
    render(<PlannedVsActualPage dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("US$\u00a07.500,00"));
    expect(text()).toContain("planejado US$\u00a04.500,00");
    expect(text()).toContain("-US$\u00a0120,00");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: a saída continua a do Intl de sempre", async () => {
    baseCurrency = "BRL";
    render(<PlannedVsActualPage dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("R$\u00a07.500,00"));
    expect(text()).toContain("-R$\u00a0120,00");
  });

  it("enquanto a base não chega, travessão — nunca R$", async () => {
    orgDelayMs = 300;
    render(<PlannedVsActualPage dataMode="live" organizationId={ORG} />);
    await screen.findByText("Alimentação");
    expect(text()).not.toMatch(/R\$/);
    await waitFor(() => expect(text()).toContain("US$\u00a07.500,00"));
  });

  it("modo demonstração (sem organização) segue em real", () => {
    render(<PlannedVsActualPage dataMode="mock" organizationId={null} />);
    expect(text()).toContain("R$\u00a07.500,00");
  });
});
