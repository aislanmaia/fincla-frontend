/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * #264 — depois de "Despesa registrada!", Minhas Contas seguia com o saldo antigo e
 * o texto "atualizado agora" até o F5.
 *
 * Nada de mock do hook: `useAccountsData` roda de verdade, e o único dublê é o
 * `apiClient` (limite HTTP). O token que o app sobe a cada transação salva é o que
 * tem de disparar a releitura.
 */
vi.mock("../../../api/client", async () => {
  const actual = await vi.importActual("../../../api/client");
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import apiClient from "../../../api/client";
import { AccountsPage } from "../AccountsPage.jsx";

let balance;
let balancesGate;
let currency;
let failBalances;

function balancesBody(amount) {
  return {
    as_of: "2026-11-04T09:00:00",
    total: { amount: String(amount), currency },
    consolidation: { target_currency: currency, rates: [], unavailable: null },
    accounts: [{ account_id: "acc-a", name: "Conta A", type: "checking", include_in_total: true,
      balance: { amount: String(amount), currency }, initial_balance: { amount: "0", currency } }],
  };
}

beforeEach(() => {
  balance = "1000.00";
  balancesGate = null;
  currency = "BRL";
  failBalances = false;
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      if (failBalances) return Promise.reject(Object.assign(new Error("boom"), { response: { status: 500, data: { detail: "Falha ao ler saldos" } } }));
      const body = { data: balancesBody(balance) };
      return balancesGate ? balancesGate.then(() => body) : Promise.resolve(body);
    }
    if (url === "/accounts") {
      return Promise.resolve({ data: [{ id: "acc-a", organization_id: "org-1", name: "Conta A", type: "checking", currency,
        initial_balance: { amount: "0", currency: "BRL" }, is_active: true, include_in_total: true }] });
    }
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const page = (token) => <AccountsPage organizationId="org-1" dataMode="live" transactionsRefreshToken={token} />;

describe("AccountsPage — recarrega depois de uma transação (#264)", () => {
  it("o token de transação salva relê os saldos e a tela mostra o valor novo", async () => {
    const { rerender } = render(page(0));
    expect((await screen.findAllByText(/1\.000,00/)).length).toBeGreaterThan(0);

    balance = "876.55";
    rerender(page(1));

    expect((await screen.findAllByText(/876,55/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/1\.000,00/)).toBeNull();
  });

  it("sem transação salva, não relê", async () => {
    const { rerender } = render(page(0));
    await screen.findAllByText(/1\.000,00/);
    const calls = apiClient.get.mock.calls.filter(([url]) => url === "/balances").length;
    rerender(page(0));
    await new Promise((r) => setTimeout(r, 30));
    expect(apiClient.get.mock.calls.filter(([url]) => url === "/balances").length).toBe(calls);
  });

  it("'atualizado agora' só aparece depois da leitura real, não durante a recarga", async () => {
    const { rerender } = render(page(0));
    expect(await screen.findByText(/atualizado agora/)).toBeInTheDocument();

    let open;
    balancesGate = new Promise((r) => { open = r; });
    balance = "876.55";
    rerender(page(1));

    expect(await screen.findByText(/atualizando…/)).toBeInTheDocument();
    expect(screen.queryByText(/atualizado agora/)).toBeNull();

    open();
    expect(await screen.findByText(/atualizado agora/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/876,55/).length).toBeGreaterThan(0));
  });

  it("durante a recarga, a lista e o total ficam na tela, na moeda deles (sem piscar 'Carregando' nem virar R$)", async () => {
    currency = "USD";
    const { rerender } = render(page(0));
    expect((await screen.findAllByText(/US\$\s?1\.000,00/)).length).toBeGreaterThan(0);

    let open;
    balancesGate = new Promise((r) => { open = r; });
    balance = "981.48";
    rerender(page(1));

    expect(await screen.findByText(/atualizando…/)).toBeInTheDocument();
    // O número anterior segue na tela COM a moeda dele — não "R$ 1.000,00".
    expect(screen.getAllByText(/US\$\s?1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/R\$\s?1\.000,00/)).toBeNull();
    expect(screen.queryByText(/Carregando contas/)).toBeNull();
    expect(screen.getAllByText("Conta A").length).toBeGreaterThan(0);

    open();
    expect((await screen.findAllByText(/US\$\s?981,48/)).length).toBeGreaterThan(0);
  });

  it("se a recarga falha, os saldos anteriores continuam e a tela não diz 'atualizado agora'", async () => {
    const { rerender } = render(page(0));
    expect((await screen.findAllByText(/1\.000,00/)).length).toBeGreaterThan(0);

    failBalances = true;
    rerender(page(1));

    expect(await screen.findByText(/não foi possível atualizar/)).toBeInTheDocument();
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/atualizado agora/)).toBeNull();
    expect(screen.queryByText(/Nenhuma conta/)).toBeNull();
  });

  it("modo demonstração (sem leitura ao vivo) não afirma estar atualizando nem atualizado", () => {
    render(<AccountsPage organizationId="org-1" dataMode="empty" transactionsRefreshToken={0} />);
    expect(screen.queryByText(/atualizando…/)).toBeNull();
    expect(screen.queryByText(/atualizado agora/)).toBeNull();
  });
});
