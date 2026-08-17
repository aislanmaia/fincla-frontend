/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountsPage } from "../AccountsPage.jsx";

/**
 * `fetchAllTransactionsPages` devolve `{ data, pagination }`, NÃO um array. Este mock
 * reproduz a forma REAL de propósito: a versão anterior desta tela fazia `rows.map`
 * direto, estourava dentro do `.then`, caía no `.catch` e o aviso de cobertura nunca
 * aparecia em produção — enquanto os testes passavam porque injetavam um fake no
 * lugar do cálculo.
 */
const fetchAllTransactionsPagesMock = vi.fn().mockResolvedValue({
  data: [
    { id: 1, account_id: "a1", type: "expense", description: "Antiga", value: 100,
      payment_method: "pix", date: "2026-08-10T12:00:00", status: "paid",
      paid_at: "2026-08-10T12:00:00", tags: {} },
  ],
  pagination: { has_next: false },
});
vi.mock("../../data/transactionsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: (...args) => fetchAllTransactionsPagesMock(...args),
}));

const getAccountBalanceMock = vi.fn().mockResolvedValue({ balance: 1300 });
vi.mock("../../../api/balances", () => ({
  getAccountBalance: (...args) => getAccountBalanceMock(...args),
}));

vi.mock("../../features/accounts/useAccountsData.js", () => ({
  useAccountsData: () => ({
    isLoading: false,
    isSaving: false,
    error: "",
    hasLoaded: true,
    total: 3750,
    totalAll: 8750,
    asOf: null,
    accounts: [
      { id: "a1", account_id: "a1", name: "Nubank", type: "checking", balance: 1300, include_in_total: true, institution: "Nubank" },
      { id: "a2", account_id: "a2", name: "XP", type: "investment", balance: 5000, include_in_total: false },
    ],
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deactivateAccount: vi.fn(),
    transfer: vi.fn(),
    reload: vi.fn(),
  }),
}));

describe("AccountsPage", () => {
  it("renderiza o saldo disponível, a lista de contas e as ações", () => {
    const { container } = render(<AccountsPage organizationId="org-1" dataMode="live" />);
    const text = container.textContent || "";

    // rótulos únicos
    expect(screen.getByText("Saldo disponível")).toBeTruthy();
    expect(screen.getByText("+ Nova conta")).toBeTruthy();
    expect(screen.getByText("⇄ Transferir")).toBeTruthy();

    // saldo disponível + contas + selo (assert robusto via textContent)
    expect(text).toContain("3.750,00");
    expect(text).toContain("Nubank");
    expect(text).toContain("XP");
    expect(text).toContain("fora do total");
  });
});

describe("AccountsPage — aviso de cobertura do acerto de saldo (S4)", () => {
  afterEach(cleanup);

  it("desembrulha a resposta paginada e mostra quantos lançamentos o acerto cobre", async () => {
    render(<AccountsPage organizationId="org-1" dataMode="live" />);

    // abre o menu da conta e o modal de acerto
    await userEvent.click(screen.getAllByLabelText(/Ações da conta/i)[0]);
    await userEvent.click(await screen.findByText(/Ajustar saldo/i));

    await waitFor(() => {
      expect(fetchAllTransactionsPagesMock).toHaveBeenCalled();
    });
    // Só liquidados: pendente não é coberto por âncora e inflaria o aviso.
    expect(fetchAllTransactionsPagesMock.mock.calls[0][0]).toMatchObject({ settled: true });

    expect(await screen.findByText(/1 lançamento desta conta/)).toBeInTheDocument();
  });
});
