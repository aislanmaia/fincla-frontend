/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * #272 — depois de lançar uma despesa, o gasto do orçamento seguia o antigo até o F5.
 *
 * Nada de mock do hook: `useBudgetsData` roda de verdade. O dublê fica nos leitores
 * da API do adapter (o limite HTTP); o mapeamento também é o de verdade.
 */
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
vi.mock("../../features/budgets/BudgetHistoryChart.jsx", () => ({
  BudgetHistoryChart: () => null,
}));
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-1", base_currency: "BRL" })),
}));

const listBudgetsMock = vi.fn();
vi.mock("../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: (...args) => listBudgetsMock(...args),
  listBudgetCategoryChoicesForUi: () => Promise.resolve([]),
  listBudgetHistoryForUi: () => Promise.resolve({ months: [] }),
}));

import { OrcamentosPage } from "../OrcamentosPage.jsx";

const budgetsBody = (spent) => ({
  budgets: [{
    id: "b1", tag_id: "t1", tag_name: "Moradia", amount: "800.00", spent_amount: spent,
    remaining_amount: String(800 - Number(spent)), currency: "BRL", status: "ok",
    period_type: "monthly", is_active: true,
  }],
});

let gate;
beforeEach(() => {
  gate = null;
  listBudgetsMock.mockImplementation(() => Promise.resolve(budgetsBody("300.00")));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const page = (token) => <OrcamentosPage organizationId="org-1" dataMode="live" transactionsRefreshToken={token} />;
const text = () => document.body.textContent ?? "";

describe("Orçamentos — recarrega depois de uma transação (#272)", () => {
  it("o token de transação salva relê e a tela mostra o gasto novo", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("300,00"));

    listBudgetsMock.mockImplementation(() => Promise.resolve(budgetsBody("425.50")));
    rerender(page(1));

    await waitFor(() => expect(text()).toContain("425,50"));
    expect(listBudgetsMock).toHaveBeenCalledTimes(2);
  });

  it("durante a recarga os números anteriores continuam (sem piscar 'carregando')", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("300,00"));

    listBudgetsMock.mockImplementation(() => new Promise((resolve) => { gate = () => resolve(budgetsBody("425.50")); }));
    rerender(page(1));
    await waitFor(() => expect(listBudgetsMock).toHaveBeenCalledTimes(2));

    expect(text()).toContain("300,00");
    expect(screen.queryByText(/Carregando/i)).toBeNull();
    gate();
    await waitFor(() => expect(text()).toContain("425,50"));
  });

  it("uma falha na recarga não apaga o que se sabia", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("300,00"));

    listBudgetsMock.mockImplementation(() => Promise.reject(Object.assign(new Error("boom"), {
      isAxiosError: true, response: { status: 500, data: { detail: "Falha" } },
    })));
    rerender(page(1));
    await waitFor(() => expect(listBudgetsMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 30));

    expect(text()).toContain("300,00");
  });
});
