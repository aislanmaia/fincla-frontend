/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** #288: editar meta com centavos não pode multiplicar o valor (1500,5 virava 15005). */

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));

const updateGoal = vi.fn().mockResolvedValue({});
const META = {
  id: "g1", nome: "Reserva", desc: "", status: "active", type: "emergency_fund",
  meta: 1500.5, atual: 100, progress: 7, monthly_target: 250.75,
  annual_return_rate: null, deadline: "2027-07-01", prazo: "Jul 2027",
  term: "medium", termExplicit: null, prioridade: "media", moeda: "BRL",
};
vi.mock("../../features/goals/useGoalsData.js", () => ({
  useGoalsData: () => ({
    isLoading: false, isSaving: false, error: "", goals: [META], hasLoaded: true,
    createGoal: vi.fn(), updateGoal, deleteGoal: vi.fn(), contribute: vi.fn(), reload: vi.fn(),
  }),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("editar meta com centavos", () => {
  it("o campo vem como '1.500,50' e salvar sem mexer grava 1500,5 (não 15005)", async () => {
    const user = userEvent.setup();
    render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
    await user.click(screen.getAllByText("Reserva")[0]);
    expect(screen.getByPlaceholderText("30.000,00")).toHaveValue("1.500,50");
    expect(screen.getByPlaceholderText("1.000,00")).toHaveValue("250,75");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateGoal).toHaveBeenCalled());
    expect(updateGoal.mock.calls[0][1]).toMatchObject({ target_amount: 1500.5, monthly_target: 250.75 });
  });
});
