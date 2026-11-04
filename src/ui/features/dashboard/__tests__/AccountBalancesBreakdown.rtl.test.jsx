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
let balancesByOrg;
let accountsMeta;
beforeEach(() => {
  balancesByOrg = null;
  accountsMeta = [{ id: "a", icon_key: "🟧" }];
  balancesBody = {
    as_of: "2026-11-04T09:00:00",
    total: money("1500.00", "BRL"),
    consolidation: { target_currency: "BRL", rates: [], unavailable: null },
    accounts: [row("a", "Itaú", "checking", "1000.00", "BRL"), row("b", "Nubank", "checking", "500.00", "BRL")],
  };
  apiClient.get.mockImplementation((url, config) => {
    if (url === "/balances") {
      const org = config?.params?.organization_id;
      return Promise.resolve({ data: balancesByOrg?.[org] ?? balancesBody });
    }
    if (url === "/accounts") return Promise.resolve({ data: accountsMeta });
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const renderNote = (props = {}) =>
  render(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={2} organizationId="org-1" {...props} />);
const balancesCalls = () => apiClient.get.mock.calls.filter(([url]) => url === "/balances");

describe("AccountBalancesNote", () => {
  it("desktop: 'em N contas' expande no próprio card (aria-expanded)", async () => {
    const user = userEvent.setup();
    renderNote();
    const toggle = await screen.findByRole("button", { name: "em 2 contas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
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
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
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
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
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
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
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
    const toggle = await screen.findByRole("button", { name: /2 contas/ });
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
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
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
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    await screen.findByText("Itaú");
    let release;
    apiClient.get.mockImplementation((url) => {
      if (url === "/accounts") return Promise.resolve({ data: accountsMeta });
      return new Promise((r) => { release = () => r({ data: { ...balancesBody, accounts: [row("a", "Itaú", "checking", "876.55", "BRL"), row("b", "Nubank", "checking", "500.00", "BRL")] } }); });
    });
    rerender(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={2} organizationId="org-1" refreshKey={1} />);
    expect(screen.getByText("Itaú")).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.getByTestId("account-balances-list")).toHaveTextContent(/876,55/));
  });

  it("celular: o sheet é portalizado no body (fora do card que tem transform)", async () => {
    const user = userEvent.setup();
    const { container } = renderNote({ isMobile: true });
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    const dialog = await screen.findByRole("dialog", { name: "Saldo por conta" });
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("o rótulo já nasce certo (pré-busca) e conta só as contas do total ('2 contas no saldo · 1 fora')", async () => {
    balancesBody = { ...balancesBody, accounts: [...balancesBody.accounts, row("x", "XP", "investment", "9000.00", "BRL", false)] };
    const user = userEvent.setup();
    let release;
    apiClient.get.mockImplementation((url) => {
      if (url === "/accounts") return Promise.resolve({ data: accountsMeta });
      return new Promise((r) => { release = () => r({ data: balancesBody }); });
    });
    render(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={3} organizationId="org-1" />);
    // Enquanto a lista não chega, não afirma número nenhum (o resumo diria "3",
    // contando a conta de investimento que está fora do total).
    expect(screen.getByRole("button", { name: "ver contas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3 contas/ })).toBeNull();
    release();
    // Pré-buscado: já certo ANTES de abrir.
    expect(await screen.findByRole("button", { name: "2 contas no saldo · 1 fora" })).toBeInTheDocument();
    expect(screen.queryByTestId("account-balances-inline")).toBeNull();
    await user.click(screen.getByRole("button", { name: "2 contas no saldo · 1 fora" }));
    expect(await screen.findByTestId("account-balances-inline")).toBeInTheDocument();
  });

  it("ícone da conta vem dos metadados de /accounts (merge do useAccountsData)", async () => {
    const user = userEvent.setup();
    renderNote();
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    const rows = await screen.findAllByTestId("account-balance-row");
    expect(rows[0]).toHaveTextContent("🟧");
  });

  it("trocar de organização fecha e nunca mostra as contas da anterior", async () => {
    balancesByOrg = {
      "org-1": balancesBody,
      "org-2": { ...balancesBody, accounts: [row("z", "Banco da Org 2", "checking", "10.00", "BRL"), row("y", "Outra", "checking", "5.00", "BRL")] },
    };
    const user = userEvent.setup();
    const { rerender } = renderNote();
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    await screen.findByText("Itaú");
    rerender(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={2} organizationId="org-2" />);
    expect(screen.queryByTestId("account-balances-inline")).toBeNull();
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    expect(await screen.findByText("Banco da Org 2")).toBeInTheDocument();
    expect(screen.queryByText("Itaú")).toBeNull();
  });

  it("fechado, uma transação gravada não rebusca; a releitura vem na próxima abertura", async () => {
    const user = userEvent.setup();
    const { rerender } = renderNote({ refreshKey: 0 });
    const toggle = await screen.findByRole("button", { name: /2 contas/ });
    await user.click(toggle);
    await screen.findByText("Itaú");
    await user.click(toggle); // fecha
    const before = balancesCalls().length;
    rerender(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={2} organizationId="org-1" refreshKey={1} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(balancesCalls().length).toBe(before);
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    await waitFor(() => expect(balancesCalls().length).toBe(before + 1));
  });

  it("releitura que falha não apresenta os valores antigos como atuais", async () => {
    const user = userEvent.setup();
    const { rerender } = renderNote({ refreshKey: 0 });
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    await screen.findByText("Itaú");
    apiClient.get.mockImplementation(() => Promise.reject(Object.assign(new Error("500"), { isAxiosError: true, response: { status: 500, data: {} } })));
    rerender(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={2} organizationId="org-1" refreshKey={1} />);
    expect(await screen.findByTestId("account-balances-freshness")).toHaveTextContent("não foi possível atualizar");
    expect(screen.getByText("Itaú")).toBeInTheDocument();
  });

  it("celular: touchcancel devolve o sheet ao lugar e não fecha", async () => {
    const user = userEvent.setup();
    renderNote({ isMobile: true });
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    const dialog = await screen.findByRole("dialog");
    const handle = screen.getByTestId("account-balances-handle");
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientY: 160 }] });
    expect(dialog.style.transform).toBe("translateY(60px)");
    fireEvent.touchCancel(document);
    expect(dialog.style.transform).toBe("translateY(0)");
    // Depois do cancel, mover o dedo não arrasta mais (ouvintes removidos).
    fireEvent.touchMove(document, { touches: [{ clientY: 400 }] });
    expect(dialog.style.transform).toBe("translateY(0)");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("celular: fechar por arrasto continua do ponto solto (sem a animação CSS que recomeça em 0)", async () => {
    const user = userEvent.setup();
    renderNote({ isMobile: true });
    await user.click(await screen.findByRole("button", { name: /2 contas/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.touchStart(screen.getByTestId("account-balances-handle"), { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientY: 260 }] });
    fireEvent.touchEnd(document);
    expect(dialog.getAttribute("data-closing")).toBe("dragged");
    expect(dialog.style.animation).toMatch(/none/);
    expect(dialog.style.transform).toBe("translateY(105%)");
  });

  it("pluraliza pela lista por conta", async () => {
    balancesBody = { ...balancesBody, accounts: [row("a", "Itaú", "checking", "1000.00", "BRL")] };
    render(<AccountBalancesNote prefix="dinheiro disponível hoje · " accountCount={1} organizationId="org-1" />);
    expect(await screen.findByRole("button", { name: "em 1 conta" })).toBeInTheDocument();
  });
});
