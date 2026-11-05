/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** #284: valor de meta que não se lê na moeda dela não vira 0 — a tela recusa. */

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));

const createGoal = vi.fn().mockResolvedValue({});
vi.mock("../../features/goals/useGoalsData.js", () => ({
  useGoalsData: () => ({
    isLoading: false, isSaving: false, error: "", goals: [], hasLoaded: true,
    createGoal, updateGoal: vi.fn(), deleteGoal: vi.fn(), contribute: vi.fn(), reload: vi.fn(),
  }),
}));
let base = "USD";
let orgResponse = null;
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => orgResponse ?? Promise.resolve({ id: "org-1", base_currency: base })),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";

beforeEach(() => {
  base = "USD";
  orgResponse = null;
  setCurrencyRegistry([
    { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
    { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: true },
  ]);
});
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
  vi.clearAllMocks();
});

async function openNew(user) {
  render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
  await user.click(screen.getByRole("button", { name: "+ Novo projeto" }));
  await user.type(screen.getByPlaceholderText("ex: Reserva de emergência"), "Viagem");
}

describe("nova meta numa organização em US$", () => {
  it("'1234,567' é ambíguo: 'Valor inválido', botão travado, nada criado", async () => {
    const user = userEvent.setup();
    await openNew(user);
    const meta = await screen.findByLabelText(/Valor da meta \(US\$\)/);
    await user.type(meta, "1234,567");
    expect(screen.getByRole("alert")).toHaveTextContent("Valor inválido");
    const criar = screen.getByRole("button", { name: "Criar projeto" });
    expect(criar).toBeDisabled();
    await user.click(criar);
    expect(createGoal).not.toHaveBeenCalled();
  });

  it("'1,500' cria a meta com alvo 1500", async () => {
    const user = userEvent.setup();
    await openNew(user);
    await user.type(await screen.findByLabelText(/Valor da meta \(US\$\)/), "1,500");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    await waitFor(() => expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ target_amount: 1500 })));
  });
});

describe("nova meta numa organização em R$", () => {
  it("'1.500' continua 1500", async () => {
    base = "BRL";
    const user = userEvent.setup();
    await openNew(user);
    await user.type(await screen.findByLabelText(/Valor da meta \(R\$\)/), "1.500");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    await waitFor(() => expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ target_amount: 1500 })));
  });
});

describe("moeda base ainda chegando", () => {
  it("'Criar projeto' fica travado até saber a moeda — '1,500' não é lido em R$ por engano", async () => {
    let resolve;
    orgResponse = new Promise((r) => { resolve = r; });
    const user = userEvent.setup();
    await openNew(user);
    await user.type(screen.getByLabelText(/Valor da meta/), "1,500");
    const criar = screen.getByRole("button", { name: "Criar projeto" });
    expect(criar).toBeDisabled();
    await user.click(criar);
    expect(createGoal).not.toHaveBeenCalled();
    resolve({ id: "org-1", base_currency: "USD" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar projeto" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));
    await waitFor(() => expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ target_amount: 1500 })));
  });
});

