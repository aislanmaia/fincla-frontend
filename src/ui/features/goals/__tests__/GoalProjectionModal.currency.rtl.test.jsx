/** @vitest-environment jsdom */

/**
 * #315 — a projeção da meta escrevia tudo em "R$" (um `Intl` chapado em "BRL"),
 * inclusive numa meta em dólar. Tudo no modal é dinheiro DA META: escreve-se na
 * moeda dela. A projeção vem pelo caminho de verdade (axios → MSW).
 */
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { GoalProjectionModal } from "../GoalProjectionModal.jsx";

const ORG = "88888888-8888-4888-8888-888888888888";
let goalCurrency = "USD";
const m = (amount) => ({ amount, currency: goalCurrency });

const server = setupServer(
  http.get("*/v1/goals/:id/projection", () =>
    HttpResponse.json({
      series: [100, 200, 300],
      monthly_contribution: m("250.00"),
      required_monthly: m("400.00"),
      annual_return_rate: 0,
      summary: { months_to_target: 10, completion_date: "2027-09-01", on_track: false, months_vs_deadline: 3 },
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

const goal = (moeda) => ({
  id: "g1", nome: "Viagem", type: "travel", progress: 25, atual: 500, meta: 2000,
  deadline: "2027-06-30", prazo: "jun/27", moeda,
});
const text = () => document.body.textContent ?? "";

describe("GoalProjectionModal — moeda da meta (#315)", () => {
  it("meta em USD: cabeçalho, aporte e necessário em US$, nenhum R$", async () => {
    goalCurrency = "USD";
    render(<GoalProjectionModal goal={goal("USD")} organizationId={ORG} onClose={vi.fn()} />);
    expect(text()).toContain("US$\u00a0500,00 / US$\u00a02.000,00");
    await waitFor(() => expect(text()).toContain("US$\u00a0250,00/mês"));
    expect(text()).toContain("US$\u00a0400,00/mês");
    expect(text()).toContain("+US$\u00a0150,00/mês a mais");
    expect(text()).not.toMatch(/R\$/);
  });

  it("meta em BRL: a saída continua a do Intl de sempre", async () => {
    goalCurrency = "BRL";
    render(<GoalProjectionModal goal={goal("BRL")} organizationId={ORG} onClose={vi.fn()} />);
    expect(text()).toContain("R$\u00a0500,00 / R$\u00a02.000,00");
    await waitFor(() => expect(text()).toContain("R$\u00a0250,00/mês"));
  });

  it("meta sem moeda conhecida: travessão, nunca R$", () => {
    render(<GoalProjectionModal goal={goal(null)} organizationId={ORG} onClose={vi.fn()} />);
    expect(text()).toContain("— / —");
    expect(text()).not.toMatch(/R\$/);
  });
});
