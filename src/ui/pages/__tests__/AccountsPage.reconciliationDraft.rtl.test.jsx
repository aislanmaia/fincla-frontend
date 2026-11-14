/** @vitest-environment jsdom */
// "Continuar conciliação" na lista de Contas (fincla-api#518): o rascunho vive no servidor, e a
// conta com conciliação em andamento oferece continuar — sem o id na URL nem no navegador.
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import contract from "../../../api/__fixtures__/statement_import.example.json";
import { normalizeStatementImportListItem } from "../../../api/statementImports";

const listDraftsMock = vi.fn();
vi.mock("../../../api/statementImports", async (importOriginal) => ({
  ...(await importOriginal()),
  listStatementImportDrafts: (...args) => listDraftsMock(...args),
}));

vi.mock("../../features/accounts/useAccountsData.js", () => ({
  useAccountsData: () => ({
    isLoading: false,
    isSaving: false,
    error: "",
    hasLoaded: true,
    total: 1300,
    totalAll: 1300,
    asOf: null,
    accounts: [
      { id: contract.draft.account_id, name: "Itaú", type: "checking", balance: 1300, include_in_total: true },
      { id: "outra", name: "Nubank", type: "checking", balance: 0, include_in_total: true },
    ],
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deactivateAccount: vi.fn(),
    transfer: vi.fn(),
    reload: vi.fn(),
  }),
}));

import { AccountsPage } from "../AccountsPage.jsx";

const drafts = () => contract.imports.imports.filter((i) => i.status === "draft").map(normalizeStatementImportListItem);

afterEach(() => {
  cleanup();
  listDraftsMock.mockReset();
});

describe("Contas: conciliação em andamento", () => {
  it("só a conta com rascunho oferece continuar, e continuar abre aquele rascunho sem abrir os lançamentos", async () => {
    listDraftsMock.mockResolvedValue(drafts());
    const onContinue = vi.fn();
    const onOpenTransactions = vi.fn();
    const user = userEvent.setup();
    render(
      <AccountsPage organizationId="org" dataMode="live" onContinueReconciliation={onContinue} onOpenAccountTransactions={onOpenTransactions} />,
    );

    const button = await screen.findByRole("button", { name: "Continuar conciliação" });
    expect(within(screen.getByRole("button", { name: "Ver lançamentos de Itaú" })).getByRole("button", { name: "Continuar conciliação" })).toBe(button);
    expect(screen.getAllByRole("button", { name: "Continuar conciliação" })).toHaveLength(1);
    await user.click(button);

    expect(onContinue).toHaveBeenCalledWith(contract.draft.account_id, contract.draft.id);
    expect(onOpenTransactions).not.toHaveBeenCalled();
    expect(listDraftsMock).toHaveBeenCalledWith("org");
  });

  it("quem não é dono (sem a ação) não busca nem vê rascunho", async () => {
    listDraftsMock.mockResolvedValue(drafts());
    render(<AccountsPage organizationId="org" dataMode="live" />);

    await screen.findByText("Itaú");
    expect(listDraftsMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Continuar conciliação" })).not.toBeInTheDocument();
  });

  it("se a busca falhar, a lista de contas segue igual", async () => {
    listDraftsMock.mockRejectedValue(new Error("rede"));
    render(<AccountsPage organizationId="org" dataMode="live" onContinueReconciliation={vi.fn()} />);

    await screen.findByText("Itaú");
    expect(screen.queryByRole("button", { name: "Continuar conciliação" })).not.toBeInTheDocument();
  });
});
