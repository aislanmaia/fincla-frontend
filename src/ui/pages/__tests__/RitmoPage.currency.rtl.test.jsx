/** @vitest-environment jsdom */

/**
 * #310 — o Ritmo escrevia "R$" em qualquer moeda base. A base vem do caminho de
 * verdade (`useOrganizationBaseCurrency` → axios → `GET /organizations/{id}`), com a
 * rede (MSW) como dublê; os lançamentos vêm do adapter mockado, como no teste de
 * recarga (#272).
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const nothing = () => null;
  return {
    ResponsiveContainer: passthrough, AreaChart: passthrough, BarChart: passthrough, ComposedChart: passthrough,
    LineChart: passthrough, Area: nothing, Bar: nothing, Line: nothing, Cell: nothing, XAxis: nothing,
    // O eixo chama o formatador como o recharts: (valor, índice).
    YAxis: ({ tickFormatter }) => <span data-testid="y-tick">{tickFormatter?.(2000, 1)}</span>,
    CartesianGrid: nothing, Tooltip: nothing, ReferenceLine: nothing, ReferenceDot: nothing, Legend: nothing,
  };
});

vi.mock("../../data/dashboardAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: () => Promise.resolve(txPage(123.45)),
}));
vi.mock("../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: () => Promise.resolve({ budgets: [] }),
}));

import { RitmoPage } from "../RitmoPage.jsx";

const ORG = "44444444-4444-4444-8444-444444444444";
const today = new Date();
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
function txPage(value) {
  return {
    data: [{ id: 1, type: "expense", value, amount: -value, date: `${ymd}T12:00:00`, payment_method: "pix", tags: {} }],
    pagination: { has_next: false },
  };
}

let baseCurrency;
const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, () => HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency })),
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
});

const text = () => document.body.textContent ?? "";

describe("Ritmo — valores na moeda base (#310)", () => {
  it("base USD: o gasto e o eixo saem em US$, nenhum R$", async () => {
    render(<RitmoPage dataMode="live" organizationId={ORG} onNav={vi.fn()} />);
    await waitFor(() => expect(text()).toContain("US$ 123,45"));
    expect(text()).toContain("US$2.0k");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: continua como antes", async () => {
    baseCurrency = "BRL";
    render(<RitmoPage dataMode="live" organizationId={ORG} onNav={vi.fn()} />);
    await waitFor(() => expect(text()).toContain("R$ 123,45"));
    expect(text()).toContain("R$2.0k");
  });
});
