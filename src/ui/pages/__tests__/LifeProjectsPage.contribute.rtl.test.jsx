/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Todo aporte sai de algum lugar (Owner, 2026-11-05). Hoje (errado), "+ Aportar"
 * criava uma receita solta e a meta nunca andava. Esperado: o aporte é da meta e
 * diz de onde o dinheiro sai e onde ele fica — reservado na mesma conta, ou
 * transferido para outra (inclusive uma criada ali mesmo).
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

const MAIN = { id: "acc-main", name: "Conta principal", type: "checking", currency: "BRL", is_active: true, created_at: "2026-01-01T00:00:00" };
const SAVINGS = { id: "acc-save", name: "Poupança", type: "savings", currency: "BRL", is_active: true, created_at: "2026-02-01T00:00:00" };
const EURO = { id: "acc-eur", name: "Euro", type: "checking", currency: "EUR", is_active: true, created_at: "2026-03-01T00:00:00" };
let accounts;
let balances;
let reserved;
const createAccount = vi.fn();
vi.mock("../../../api/accounts", () => ({
  listAccounts: () => Promise.resolve(accounts),
  createAccount: (...a) => createAccount(...a),
}));
vi.mock("../../../api/balances", () => ({
  getOrgBalances: () => Promise.resolve({ accounts: balances }),
}));
vi.mock("../../../api/goals", () => ({
  getReservedSummary: () => Promise.resolve(reserved),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";
import { todayLocalYmd as today } from "../../data/transactionsAdapter.js";

beforeEach(() => {
  goals = [META];
  accounts = [MAIN, SAVINGS, EURO];
  balances = [
    { account_id: "acc-main", balance: 5000, currency: "BRL" },
    { account_id: "acc-save", balance: 0, currency: "BRL" },
    { account_id: "acc-eur", balance: 900, currency: "EUR" },
  ];
  reserved = { totals: [], by_account: [], by_goal: [] };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const money = (text) => new RegExp(text.replace(/\s/g, "\\s").replace(/\$/g, "\\$"));

async function openAporte(user) {
  render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
  await user.click(screen.getByRole("button", { name: "+ Aportar" }));
  const dialog = screen.getByRole("dialog", { name: "Novo aporte" });
  await within(dialog).findByLabelText("Sai de");
  return dialog;
}

describe("+ Aportar", () => {
  it("sem escolher destino, só reserva na conta de onde sai (nada se move)", async () => {
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    expect(within(dialog).getByLabelText("Sai de")).toHaveValue("acc-main");
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    await user.type(within(dialog).getByLabelText(/Observação/), "Salário de novembro");
    await user.click(within(dialog).getByRole("button", { name: money("Reservar R$ 400,00") }));

    await waitFor(() => expect(contribute).toHaveBeenCalled());
    expect(contribute).toHaveBeenCalledWith("g1", {
      amount: 400, contributed_at: today(), note: "Salário de novembro", account_id: "acc-main",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("só oferece contas na moeda da meta", async () => {
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    const names = within(within(dialog).getByLabelText("Sai de")).getAllByRole("option").map((o) => o.textContent);
    expect(names.some((n) => n.includes("Euro"))).toBe(false);
  });

  it("escolher outra conta vira transferência para ela", async () => {
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    await user.selectOptions(within(dialog).getByLabelText("Onde o dinheiro fica guardado"), "acc-save");
    await user.click(within(dialog).getByRole("button", { name: money("Transferir R$ 400,00") }));

    await waitFor(() => expect(contribute).toHaveBeenCalled());
    expect(contribute.mock.calls[0][1]).toMatchObject({ account_id: "acc-main", destination_account_id: "acc-save" });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("a prévia mostra total, reservado e disponível", async () => {
    reserved = { totals: [{ currency: "BRL", amount: 100 }], by_account: [], by_goal: [] };
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    const preview = within(dialog).getByLabelText("Prévia do aporte");
    expect(preview.textContent).toMatch(money("R$ 5.000,00"));
    expect(preview.textContent).toMatch(money("R$ 500,00"));
    expect(preview.textContent).toMatch(money("R$ 4.500,00"));
  });

  it("com uma conta só: convida a separar, sugere a Poupança e cria a conta junto", async () => {
    accounts = [MAIN];
    createAccount.mockResolvedValue({ id: "acc-new", name: "Poupança", type: "savings", currency: "BRL" });
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    expect(within(dialog).getByText("Quer separar esse dinheiro?")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Onde o dinheiro fica guardado")).toHaveValue("same");

    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    await user.selectOptions(within(dialog).getByLabelText("Onde o dinheiro fica guardado"), "new");
    expect(within(dialog).getByLabelText("Nome da nova conta")).toHaveValue("Poupança");
    await user.click(within(dialog).getByRole("button", { name: "Criar conta e transferir" }));

    await waitFor(() => expect(contribute).toHaveBeenCalled());
    expect(createAccount).toHaveBeenCalledWith("org-1", { name: "Poupança", type: "savings", currency: "BRL" });
    expect(contribute.mock.calls[0][1]).toMatchObject({ account_id: "acc-main", destination_account_id: "acc-new" });
  });

  it("conta criada e aporte recusado: a nova tentativa usa a conta criada, sem criar outra", async () => {
    accounts = [MAIN];
    createAccount.mockResolvedValue({ id: "acc-new", name: "Caixinha", type: "savings", currency: "BRL" });
    contribute.mockRejectedValueOnce(new Error("Falhou agora"));
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    await user.selectOptions(within(dialog).getByLabelText("Onde o dinheiro fica guardado"), "new");
    await user.clear(within(dialog).getByLabelText("Nome da nova conta"));
    await user.type(within(dialog).getByLabelText("Nome da nova conta"), "Caixinha");
    await user.click(within(dialog).getByRole("button", { name: "Criar conta e transferir" }));

    expect(await within(dialog).findByText("Falhou agora")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Onde o dinheiro fica guardado")).toHaveValue("acc-new");
    await user.click(within(dialog).getByRole("button", { name: money("Transferir R$ 400,00") }));

    await waitFor(() => expect(contribute).toHaveBeenCalledTimes(2));
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(contribute.mock.calls[1][1]).toMatchObject({ destination_account_id: "acc-new" });
  });

  it("sem valor (ou valor zero) não grava nada", async () => {
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    expect(within(dialog).getByRole("button", { name: "Registrar aporte" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "0");
    expect(within(dialog).getByRole("button", { name: "Registrar aporte" })).toBeDisabled();
    expect(contribute).not.toHaveBeenCalled();
  });

  it("erro do servidor mantém o modal aberto com o que foi digitado e mostra a mensagem", async () => {
    contribute.mockRejectedValueOnce(new Error("Meta não está ativa"));
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    await user.click(within(dialog).getByRole("button", { name: money("Reservar R$ 400,00") }));
    expect(await within(dialog).findByText("Meta não está ativa")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Valor do aporte/)).toHaveValue("400,00");
  });

  it("data futura digitada não grava", async () => {
    const user = userEvent.setup();
    const dialog = await openAporte(user);
    await user.type(within(dialog).getByLabelText(/Valor do aporte/), "400,00");
    const date = within(dialog).getByLabelText(/Data do aporte/);
    await user.clear(date);
    await user.type(date, "2099-01-15");
    expect(within(dialog).getByText("A data não pode ser no futuro")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: money("Reservar R$ 400,00") })).toBeDisabled();
  });

  it("meta concluída ou cancelada não oferece aporte", () => {
    goals = [{ ...META, status: "completed" }, { ...META, id: "g2", nome: "Outra", status: "cancelled" }];
    render(<LifeProjectsPage organizationId="org-1" dataMode="live" />);
    expect(screen.queryByRole("button", { name: "+ Aportar" })).not.toBeInTheDocument();
  });

  it("no modo demonstração o aporte soma na meta local, sem contas", async () => {
    const user = userEvent.setup();
    render(<LifeProjectsPage dataMode="mock" organizationId={null} initialMetas={[{ ...META, id: "m1" }]} />);
    await user.click(screen.getByRole("button", { name: "+ Aportar" }));
    expect(screen.queryByLabelText("Sai de")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Valor do aporte/), "600,00");
    await user.click(screen.getByRole("button", { name: "Registrar aporte" }));
    await waitFor(() => expect(screen.getByText("10%")).toBeInTheDocument());
  });
});
