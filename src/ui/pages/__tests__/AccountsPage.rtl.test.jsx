/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountsPage } from "../AccountsPage.jsx";

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
