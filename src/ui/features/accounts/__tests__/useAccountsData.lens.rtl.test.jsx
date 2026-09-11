/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * A lente no HOOK, e não na tela.
 *
 * **Por que este arquivo existe.** O teste da `AccountsPage` mocka
 * `useAccountsData` inteiro, então ele prova que a tela PASSA a lente e não que
 * alguém a LÊ. Provei apagando `lente` da chave do `useEffect`: a página seguia
 * verde, o seletor mudava, e o número na tela nunca se atualizava — a lente
 * pareceria funcionar e não faria nada.
 *
 * O que se mede aqui é a releitura: trocar a lente tem de produzir uma nova
 * requisição, com `target_currency`.
 */

const getOrgBalancesMock = vi.fn();
const listAccountsMock = vi.fn();

vi.mock("../../../../api/balances", () => ({
  getOrgBalances: (...args) => getOrgBalancesMock(...args),
}));
vi.mock("../../../../api/accounts", () => ({
  listAccounts: (...args) => listAccountsMock(...args),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deactivateAccount: vi.fn(),
}));
vi.mock("../../../../api/transfers", () => ({ createTransfer: vi.fn() }));
vi.mock("../../../../api/balanceAdjustments", () => ({
  createBalanceAdjustment: vi.fn(),
  listBalanceAdjustments: vi.fn(),
  updateBalanceAdjustment: vi.fn(),
  deleteBalanceAdjustment: vi.fn(),
}));

import { useAccountsData } from "../useAccountsData.js";

function Sonda({ lente }) {
  const data = useAccountsData({ organizationId: "org-1", lente });
  return <div data-testid="total">{String(data.total)}</div>;
}

beforeEach(() => {
  getOrgBalancesMock.mockReset();
  listAccountsMock.mockReset();
  listAccountsMock.mockResolvedValue([]);
  getOrgBalancesMock.mockImplementation((_org, _at, alvo) =>
    Promise.resolve({
      total: alvo === "EUR" ? 268.29 : 1594.19,
      accounts: [],
      consolidation: { target_currency: alvo ?? "BRL", rates: [], unavailable: null },
      as_of: null,
    }),
  );
});
afterEach(cleanup);

describe("trocar a lente RELÊ os saldos", () => {
  it("a primeira leitura vai sem moeda — a base da organização", async () => {
    render(<Sonda lente={null} />);

    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("1594.19"));
    expect(getOrgBalancesMock).toHaveBeenCalledWith("org-1", undefined, null);
  });

  it("mudar a lente dispara uma NOVA leitura, e o número muda", async () => {
    const { rerender } = render(<Sonda lente={null} />);
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("1594.19"));

    rerender(<Sonda lente="EUR" />);

    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("268.29"));
    expect(getOrgBalancesMock).toHaveBeenCalledWith("org-1", undefined, "EUR");
    expect(getOrgBalancesMock).toHaveBeenCalledTimes(2);
  });

  it("voltar para a base relê de novo", async () => {
    const { rerender } = render(<Sonda lente="EUR" />);
    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("268.29"));

    rerender(<Sonda lente={null} />);

    await waitFor(() => expect(screen.getByTestId("total").textContent).toBe("1594.19"));
  });
});
