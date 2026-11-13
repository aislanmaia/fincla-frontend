/** @vitest-environment jsdom */

/**
 * #315 — Saúde Financeira e Capacidade de Economia escreviam os agregados (patrimônio,
 * médias, sobra por mês) com um `Intl.NumberFormat(..., "BRL")` de módulo: "R$" com
 * qualquer moeda base. Esses valores vêm convertidos na base da organização.
 *
 * Base e números vêm pelo caminho de verdade (axios → MSW), sem dublê de hook.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";

import { HealthPanelPage } from "../HealthPanelPage.jsx";
import { CapacityPanel } from "../../features/financialHealth/CapacityPanel.jsx";

const ORG = "77777777-7777-4777-8777-777777777777";
let baseCurrency;
let orgDelayMs;
const m = (amount) => ({ amount, currency: baseCurrency });

const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, async () => {
    if (orgDelayMs) await delay(orgDelayMs);
    return HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency });
  }),
  http.get("*/v1/financial-health/score", () =>
    HttpResponse.json({
      reference_month: "2026-11-01", ativo: m("8500.00"), passivo: m("1200.00"), patrimonio_liquido: m("7300.00"),
      avg_income: m("7000.00"), avg_expense: m("4500.00"), avg_surplus: m("2500.00"),
      income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
      goals_on_track: 1, goals_total: 2, goal_progress_avg: 40, cash_flow_risk: "low", score: 72,
    }),
  ),
  http.get("*/v1/financial-health/economy-capacity", () =>
    HttpResponse.json({
      avg_income: m("7000.00"), avg_expense: m("4500.00"), avg_surplus: m("2500.00"), savings_rate: 0.36,
      trend: "stable", window_months: 3, months_with_data: 3,
      months: [{ year: 2026, month: 10, month_name: "outubro", surplus: m("120.00") }],
      current_month: { income: m("7000.00"), expense: m("4000.00"), surplus: m("3000.00") },
    }),
  ),
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

describe("Saúde Financeira — agregados na moeda base (#315)", () => {
  it("base USD: patrimônio e médias em US$, nenhum R$", async () => {
    render(<HealthPanelPage dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("US$\u00a07.300,00"));
    expect(text()).toContain("US$\u00a02.500,00");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: a saída continua a do Intl de sempre", async () => {
    baseCurrency = "BRL";
    render(<HealthPanelPage dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("R$\u00a07.300,00"));
  });

  it("enquanto a base não chega, travessão — nunca R$", async () => {
    orgDelayMs = 300;
    render(<HealthPanelPage dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("taxa de poupança 36%"));
    expect(text()).not.toMatch(/R\$/);
    await waitFor(() => expect(text()).toContain("US$\u00a07.300,00"));
  });
});

describe("Capacidade de Economia — agregados na moeda base (#315)", () => {
  it("base USD: médias, mês corrente e barras em US$, nenhum R$", async () => {
    render(<CapacityPanel dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("US$\u00a02.500,00"));
    expect(text()).toContain("US$\u00a0120,00");
    expect(text()).toContain("receita US$\u00a07.000,00");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: a saída continua a do Intl de sempre", async () => {
    baseCurrency = "BRL";
    render(<CapacityPanel dataMode="live" organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("R$\u00a0120,00"));
  });
});
