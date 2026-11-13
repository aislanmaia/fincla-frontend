/** @vitest-environment jsdom */

/**
 * #315 — as transações semeadas no onboarding saíam em "R$" chapado. São valores da
 * organização recém-criada: escrevem-se na moeda BASE dela. A base vem pelo caminho
 * de verdade (axios → MSW).
 */
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { TransactionsEmptyState } from "../TransactionsEmptyState.jsx";

const ORG = "99999999-9999-4999-8999-999999999999";
let baseCurrency = "USD";
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

const extraTx = [
  { id: "onb-tx-1", desc: "Salário", cat: "Salário", val: 3000, date: "05/04", icon: "💼", method: "Pix", rec: true },
  { id: "onb-tx-2", desc: "Aluguel", cat: "Moradia", val: -1200.5, date: "10/04", icon: "🏠", method: "Pix", rec: true },
];
const text = () => document.body.textContent ?? "";

describe("TransactionsEmptyState — moeda base (#315)", () => {
  it("base USD: valores semeados em US$, nenhum R$", async () => {
    baseCurrency = "USD";
    render(<TransactionsEmptyState extraTx={extraTx} onNewTx={vi.fn()} organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("+US$ 3.000,00"));
    expect(text()).toContain("−US$ 1.200,50");
    expect(text()).not.toMatch(/R\$/);
  });

  it("base BRL: continua como antes (espaço comum)", async () => {
    baseCurrency = "BRL";
    render(<TransactionsEmptyState extraTx={extraTx} onNewTx={vi.fn()} organizationId={ORG} />);
    await waitFor(() => expect(text()).toContain("+R$ 3.000,00"));
    expect(text()).toContain("−R$ 1.200,50");
  });
});
