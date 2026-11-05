/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Hoje (errado): "+ Aportar" abria a transação genérica como receita e a meta
 * nunca andava. Esperado: o botão abre o aporte da própria meta e grava uma
 * contribuição nela.
 */

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }));

const contribute = vi.fn().mockResolvedValue({});
let goals;
const META = {
  id: "g1", nome: "Viagem para o Nordeste", desc: "", status: "active", type: "travel",
  meta: 6000, atual: 0, progress: 0, monthly_target: 400, annual_return_rate: null,
  deadline: "2027-12-01", prazo: "Dez 2027", term: "medium", termExplicit: null, prioridade: "media", moeda: "BRL",
};
vi.mock("../../features/goals/useGoalsData.js", () => ({
  useGoalsData: () => ({
    isLoading: false, isSaving: false, error: "", goals, hasLoaded: true,
    createGoal: vi.fn(), updateGoal: vi.fn(), contribute,
  }),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

beforeEach(() => { goals = [META]; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("+ Aportar", () => {
  it("abre o aporte da meta e grava a contribuição nela, na data de hoje", async () => {
    const user = userEvent.setup();
    render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
    await user.click(screen.getByRole("button", { name: "+ Aportar" }));

    expect(screen.getByText("Viagem para o Nordeste", { selector: "[data-contribution-goal]" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Valor do aporte/), "400,00");
    await user.type(screen.getByLabelText(/Observação/), "Salário de novembro");
    await user.click(screen.getByRole("button", { name: "Registrar aporte" }));

    await waitFor(() => expect(contribute).toHaveBeenCalled());
    expect(contribute).toHaveBeenCalledWith("g1", { amount: 400, contributed_at: today(), note: "Salário de novembro" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Registrar aporte" })).not.toBeInTheDocument());
  });

  it("sem valor (ou valor zero) não grava nada", async () => {
    const user = userEvent.setup();
    render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
    await user.click(screen.getByRole("button", { name: "+ Aportar" }));
    expect(screen.getByRole("button", { name: "Registrar aporte" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Valor do aporte/), "0");
    expect(screen.getByRole("button", { name: "Registrar aporte" })).toBeDisabled();
    expect(contribute).not.toHaveBeenCalled();
  });

  it("erro do servidor mantém o modal aberto com o que foi digitado", async () => {
    contribute.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
    await user.click(screen.getByRole("button", { name: "+ Aportar" }));
    await user.type(screen.getByLabelText(/Valor do aporte/), "400,00");
    await user.click(screen.getByRole("button", { name: "Registrar aporte" }));
    await waitFor(() => expect(contribute).toHaveBeenCalled());
    expect(screen.getByLabelText(/Valor do aporte/)).toHaveValue("400,00");
  });

  it("no modo demonstração o aporte soma na meta local", async () => {
    const user = userEvent.setup();
    render(<LifeProjectsPage dataMode="mock" organizationId={null} initialMetas={[{ ...META, id: "m1" }]} />);
    await user.click(screen.getByRole("button", { name: "+ Aportar" }));
    await user.type(screen.getByLabelText(/Valor do aporte/), "600,00");
    await user.click(screen.getByRole("button", { name: "Registrar aporte" }));
    await waitFor(() => expect(screen.getByText("10%")).toBeInTheDocument());
  });
});
