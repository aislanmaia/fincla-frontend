/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** #284: limite de orçamento em iene (sem casas) abre e salva sem mexer. */

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));
const updateBudget = vi.fn().mockResolvedValue({});
let cats;
let budgetsData;
vi.mock("../../features/budgets/useBudgetsData.js", () => ({
  // Objeto ESTÁVEL entre renders, como o hook de verdade.
  useBudgetsData: () => budgetsData,
}));
vi.mock("../../features/budgets/BudgetHistoryChart.jsx", () => ({ BudgetHistoryChart: () => null }));
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-1", base_currency: "JPY" })),
}));

import { OrcamentosPage } from "../OrcamentosPage.jsx";
import { getOrganization } from "../../../api/organizations";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";

beforeEach(() => {
  setCurrencyRegistry([
    { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
    { code: "JPY", name: "Iene", symbol: "¥", decimal_places: 0, is_active: true },
  ]);
  cats = [{
    id: "b1", slug: "moradia", budgetId: "b1", tagId: "t1", nome: "Moradia", categoryIconKey: null, emoji: "🏠",
    limite: 150000, gasto: 0, moeda: "JPY", membros: [], envelopes: [], navFilter: "t1", color: "#888", foraDoOrcamento: [],
  }];
  budgetsData = {
    isLoading: false, isSaving: false, error: "",
    data: { budget: 150000, totalGasto: 0, totalDisp: 150000, totalPct: 0, alertCount: 0, healthLabel: "ok", moeda: "JPY", porMoeda: [], gastoPorMoeda: [], cats },
    choices: [], history: [], createBudget: vi.fn(), updateBudget, reload: vi.fn(),
  };
});
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
  vi.clearAllMocks();
});

describe("orçamento em iene", () => {
  it("editar abre '150.000' (sem casas) e salvar sem mexer grava 150000", async () => {
    const user = userEvent.setup();
    render(<OrcamentosPage organizationId="org-1" dataMode="live" />);
    // O CatCard é recriado quando a moeda base chega: espera esse render antes de
    // pegar o botão, senão o clique cai num nó já desmontado.
    await waitFor(() => expect(getOrganization).toHaveBeenCalled());
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Editar limite de Moradia" }));
    const field = await screen.findByLabelText("Limite mensal");
    expect(field).toHaveValue("150.000");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateBudget).toHaveBeenCalledWith("b1", { amount: 150000 }));
  });
});
