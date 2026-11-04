// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Saldo em conta" da Visão Geral: "em N contas" abre o saldo POR CONTA. Mock só no
 * limite HTTP (`apiClient`): `getOrgBalances` e a normalização de dinheiro rodam
 * de verdade.
 */
vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual("../../../../api/client");
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

import apiClient from "../../../../api/client";
import { AccountBalancesNote } from "../AccountBalancesBreakdown.jsx";

const money = (amount, currency) => ({ amount: String(amount), currency });
const row = (account_id, name, type, amount, currency, include_in_total = true) => ({
  account_id, name, type, include_in_total, balance: money(amount, currency), initial_balance: money(0, currency),
});

let balancesBody;
beforeEach(() => {
  balancesBody = {
    as_of: "2026-11-04T09:00:00",
    total: money("1500.00", "BRL"),
    consolidation: { target_currency: "BRL", rates: [], unavailable: null },
    accounts: [row("a", "Itaú", "checking", "1000.00", "BRL"), row("b", "Nubank", "checking", "500.00", "BRL")],
  };
  apiClient.get.mockImplementation((url) => (url === "/balances" ? Promise.resolve({ data: balancesBody }) : Promise.resolve({ data: [] })));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const renderNote = (props = {}) =>
  render(<AccountBalancesNote prefix="dinheiro disponível hoje · " label="em 2 contas" organizationId="org-1" {...props} />);

describe("AccountBalancesNote", () => {
  it("desktop: 'em N contas' expande no próprio card (aria-expanded), buscando só ao abrir", async () => {
    const user = userEvent.setup();
    renderNote();
    const toggle = screen.getByRole("button", { name: "em 2 contas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(apiClient.get).not.toHaveBeenCalled();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const inline = await screen.findByTestId("account-balances-inline");
    expect(await within(inline).findByText("Itaú")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(toggle);
    expect(screen.queryByTestId("account-balances-inline")).toBeNull();
  });

  it("cada conta no SEU câmbio; com mais de uma moeda, o recibo da conversão", async () => {
    balancesBody = {
      ...balancesBody,
      total: money("1548.00", "BRL"),
      consolidation: { target_currency: "BRL", rates: [{ base: "USD", quote: "BRL", rate: "5.48", quoted_on: "2026-11-03" }], unavailable: null },
      accounts: [row("a", "Itaú", "checking", "1000.00", "BRL"), row("w", "Wise", "checking", "100.00", "USD")],
    };
    const user = userEvent.setup();
    renderNote();
    await user.click(screen.getByRole("button", { name: "em 2 contas" }));
    const list = await screen.findByTestId("account-balances-list");
    const rows = within(list).getAllByTestId("account-balance-row");
    expect(rows[0]).toHaveTextContent(/R\$\s?1\.000,00/);
    expect(rows[1]).toHaveTextContent(/US\$\s?100,00/);
    expect(within(list).getByTestId("account-balances-total")).toHaveTextContent(/R\$\s?1\.548,00/);
    expect(within(list).getByTestId("account-balances-receipt")).toHaveTextContent(/Convertido com 1 USD = R\$\s?5,48 \(03\/11\)/);
  });

  it("sem cotação: total POR MOEDA, nunca um total zerado", async () => {
    balancesBody = {
      ...balancesBody,
      total: null,
      consolidation: { target_currency: "BRL", rates: [], unavailable: "USD" },
      accounts: [row("a", "Itaú", "checking", "1000.00", "BRL"), row("w", "Wise", "checking", "100.00", "USD")],
    };
    const user = userEvent.setup();
    renderNote();
    await user.click(screen.getByRole("button", { name: "em 2 contas" }));
    const list = await screen.findByTestId("account-balances-list");
    expect(within(list).queryByTestId("account-balances-total")).toBeNull();
    const byCurrency = within(list).getByTestId("account-balances-by-currency");
    expect(byCurrency).toHaveTextContent(/R\$\s?1\.000,00/);
    expect(byCurrency).toHaveTextContent(/US\$\s?100,00/);
    expect(list.textContent).not.toMatch(/R\$\s?0,00/);
  });

  it("contas fora do total ficam num grupo à parte, 'Fora do saldo disponível'", async () => {
    balancesBody = {
      ...balancesBody,
      accounts: [...balancesBody.accounts, row("x", "XP Investimentos", "investment", "9000.00", "BRL", false)],
    };
    const user = userEvent.setup();
    renderNote();
    await user.click(screen.getByRole("button", { name: "em 2 contas" }));
    const excluded = await screen.findByTestId("account-balances-excluded");
    expect(excluded).toHaveTextContent("Fora do saldo disponível");
    expect(within(excluded).getByText("XP Investimentos")).toBeInTheDocument();
    const included = screen.getByTestId("account-balances-list").querySelector("ul");
    expect(within(included).queryByText("XP Investimentos")).toBeNull();
  });

  it("celular: abre um sheet; fecha no ✕, no fundo e no Esc (sem depender de onAnimationEnd)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderNote({ isMobile: true });
    const toggle = screen.getByRole("button", { name: "em 2 contas" });
    expect(toggle).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(toggle);
    const dialog = await screen.findByRole("dialog", { name: "Saldo por conta" });
    expect(await within(dialog).findByText("Nubank")).toBeInTheDocument();
    expect(screen.queryByTestId("account-balances-inline")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Fechar saldo por conta" }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(toggle);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByTestId("account-balances-backdrop"));
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(toggle);
    await screen.findByRole("dialog");
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("celular: arrastar a alça para baixo fecha", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderNote({ isMobile: true });
    await user.click(screen.getByRole("button", { name: "em 2 contas" }));
    await screen.findByRole("dialog");
    const handle = screen.getByTestId("account-balances-handle");
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(document);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uma transação gravada relê os saldos sem apagar a lista da tela", async () => {
    const user = userEvent.setup();
    const { rerender } = renderNote({ refreshKey: 0 });
    await user.click(screen.getByRole("button", { name: "em 2 contas" }));
    await screen.findByText("Itaú");
    let release;
    apiClient.get.mockImplementation(() => new Promise((r) => { release = () => r({ data: { ...balancesBody, accounts: [row("a", "Itaú", "checking", "876.55", "BRL"), row("b", "Nubank", "checking", "500.00", "BRL")] } }); }));
    rerender(<AccountBalancesNote prefix="dinheiro disponível hoje · " label="em 2 contas" organizationId="org-1" refreshKey={1} />);
    expect(screen.getByText("Itaú")).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.getByTestId("account-balances-list")).toHaveTextContent(/876,55/));
  });
});
