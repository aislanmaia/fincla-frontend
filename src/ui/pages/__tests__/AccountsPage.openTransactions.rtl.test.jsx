/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../features/accounts/useAccountsData.js", () => ({
  useAccountsData: () => ({
    isLoading: false, isSaving: false, error: "", hasLoaded: true, total: 1500, consolidation: { target_currency: "BRL", rates: [] },
    accounts: [
      { id: "acc-a", account_id: "acc-a", name: "Conta A Itaú", type: "checking", currency: "BRL", balance: 1000, include_in_total: true },
      { id: "acc-b", account_id: "acc-b", name: "Conta B Nubank", type: "checking", currency: "BRL", balance: 500, include_in_total: true },
    ],
    createAccount: vi.fn(), updateAccount: vi.fn(), deactivateAccount: vi.fn(), transfer: vi.fn(), reload: vi.fn(),
  }),
}));
vi.mock("../../data/transactionsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: vi.fn().mockResolvedValue({ data: [], pagination: { has_next: false } }),
}));
vi.mock("../../../api/balances", () => ({ getAccountBalance: vi.fn().mockResolvedValue({ balance: 0 }) }));

import { AccountsPage } from "../AccountsPage.jsx";

afterEach(cleanup);

describe("Minhas Contas → Transações filtradas na conta (#268)", () => {
  it("tocar numa conta abre os lançamentos dela", async () => {
    const onOpen = vi.fn();
    render(<AccountsPage organizationId="org-1" dataMode="live" onOpenAccountTransactions={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver lançamentos de Conta B Nubank" }));
    expect(onOpen).toHaveBeenCalledWith("acc-b");
  });

  it("o menu da conta (⋮) não abre os lançamentos", async () => {
    const onOpen = vi.fn();
    render(<AccountsPage organizationId="org-1" dataMode="live" onOpenAccountTransactions={onOpen} />);
    await userEvent.click(screen.getAllByLabelText("Ações da conta")[0]);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
