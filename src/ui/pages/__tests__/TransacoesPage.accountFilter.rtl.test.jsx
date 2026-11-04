/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * #268 — filtro "Conta" em Transações: só com 2+ contas ativas, recorta lista E
 * resumo, chega pela URL (`fc_account`, vindo de Minhas Contas), e com UMA conta
 * filtrada a lista mostra também as transferências dela, fora dos totais.
 */

let routerSearch = {};
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => routerSearch,
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions", search: routerSearch } })
      : { location: { pathname: "/transactions", search: routerSearch } },
}));

const baseTransactions = [
  { id: "tx-1", date: "10/11/2026", desc: "Mercado", cat: "Alimentação", val: -100, method: "Pix",
    type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [], settled: true, settleable: true },
  { id: "tx-2", date: "02/11/2026", desc: "Padaria", cat: "Alimentação", val: -20, method: "Pix",
    type: "expense", icon: "🍞", status: "confirmado", rec: false, tags: [], settled: true, settleable: true },
];
let summaryMock;
const transactionsDataMock = vi.fn(() => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: summaryMock,
  transactions: baseTransactions,
  total: 2, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
}));
vi.mock("../../features/transactions/useTransactionsData.js", () => ({
  useTransactionsData: (...args) => transactionsDataMock(...args),
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({ isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] }),
}));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => ({ rows: [], loading: false, error: "" }),
}));
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => ({ counts: null, isLoading: false, total: null, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null }),
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const listTransfersMock = vi.fn();
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));

import { TransacoesPage } from "../TransacoesPage.jsx";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_EUR = "eeeeeeee-0000-4000-8000-000000000003";
const TWO_ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL" },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL" },
];

beforeEach(() => {
  routerSearch = {};
  localStorage.clear();
  summaryMock = { total_income: 0, total_expenses: 120, total_refunds: 0, balance: -120, currency: "BRL" };
  listAccountsMock.mockResolvedValue(TWO_ACCOUNTS);
  listTransfersMock.mockResolvedValue([]);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (props = {}) =>
  render(
    <TransacoesPage onNav={vi.fn()} onNewTx={vi.fn()} onEditTx={vi.fn()} isMobile={false} dataMode="live"
      organizationId="org-test" transactionsRefreshToken={0} onTransactionsInvalidate={vi.fn()} {...props} />,
  );

const lastFilters = () => transactionsDataMock.mock.calls.at(-1)[0].filters;

async function openFilters() {
  const btn = screen.queryAllByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })[0];
  if (btn && btn.getAttribute("aria-expanded") !== "true") await userEvent.click(btn);
}

describe("<TransacoesPage> — filtro Conta (#268)", () => {
  it("com 2+ contas, fc_account (vindo de Minhas Contas) recorta lista e resumo: accountIds chega ao hook", async () => {
    routerSearch = { fc_account: ACC_B };
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await waitFor(() => expect(lastFilters().accountIds).toEqual([ACC_B]));
  });

  it("com 2+ contas, a faceta Conta aparece no painel e selecionar uma conta recorta", async () => {
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await openFilters();
    await userEvent.click(await screen.findByRole("button", { name: /^Conta\b/ }));
    const group = await screen.findByRole("group", { name: "Contas" });
    await userEvent.click(within(group).getByRole("button", { name: /Conta A Itaú/ }));
    await waitFor(() => expect(lastFilters().accountIds).toEqual([ACC_A]));
  });

  it("com UMA conta, a faceta não aparece e um fc_account vindo da URL não tem efeito", async () => {
    listAccountsMock.mockResolvedValue([TWO_ACCOUNTS[0]]);
    routerSearch = { fc_account: ACC_A };
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await waitFor(() => expect(lastFilters().accountIds).toBeUndefined());
    await openFilters();
    expect(screen.queryByRole("button", { name: /^Conta\b/ })).toBeNull();
  });

  it("UMA conta filtrada: transferências viram linhas próprias, na moeda da conta, fora dos totais", async () => {
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue([
      { id: "t-out", from_account_id: ACC_B, to_account_id: ACC_A, amount: 300, to_amount: 300, from_currency: "BRL", to_currency: "BRL", date: "2026-11-05T12:00:00" },
      { id: "t-in", from_account_id: ACC_A, to_account_id: ACC_B, amount: 50, to_amount: 50, from_currency: "BRL", to_currency: "BRL", date: "2026-11-08T12:00:00" },
      { id: "t-old", from_account_id: ACC_B, to_account_id: ACC_A, amount: 999, to_amount: 999, from_currency: "BRL", to_currency: "BRL", date: "2026-09-01T12:00:00" },
    ]);
    renderPage();
    expect((await screen.findAllByText("Transferência para Conta A Itaú")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transferência de Conta A Itaú").length).toBeGreaterThan(0);
    expect(listTransfersMock).toHaveBeenCalledWith("org-test", ACC_B);
    // Fora do período escolhido, não entra.
    expect(screen.queryByText(/999,00/)).toBeNull();
    // Totais: os do servidor (R$ 120,00 de despesas), sem as transferências.
    expect(screen.getAllByText(/120,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/420,00/)).toBeNull();
  });

  it("transferência no extrato: tocar mostra o detalhe, sem editar/excluir", async () => {
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue([
      { id: "t-out", from_account_id: ACC_B, to_account_id: ACC_A, amount: 300, to_amount: 300, from_currency: "BRL", to_currency: "BRL", date: "2026-11-05T12:00:00" },
    ]);
    const onEditTx = vi.fn();
    renderPage({ onEditTx });
    await userEvent.click((await screen.findAllByText("Transferência para Conta A Itaú"))[0]);
    const detail = await screen.findByTestId("transfer-detail");
    expect(detail).toHaveTextContent("não entra em receitas nem despesas");
    expect(screen.queryByRole("button", { name: /^Editar$/ })).toBeNull();
  });

  it("sem filtro de conta, nenhuma transferência na lista", async () => {
    listTransfersMock.mockResolvedValue([
      { id: "t-out", from_account_id: ACC_B, to_account_id: ACC_A, amount: 300, to_amount: 300, from_currency: "BRL", to_currency: "BRL", date: "2026-11-05T12:00:00" },
    ]);
    renderPage();
    await screen.findAllByText("Mercado");
    expect(listTransfersMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Transferência para/)).toBeNull();
  });

  it("resumo de uma conta em euro sai em €, não em R$", async () => {
    listAccountsMock.mockResolvedValue([...TWO_ACCOUNTS, { id: ACC_EUR, name: "Conta Euro", currency: "EUR" }]);
    routerSearch = { fc_account: ACC_EUR };
    summaryMock = { total_income: 0, total_expenses: 80, total_refunds: 0, balance: -80, currency: "EUR" };
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/€\s?80,00/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/R\$\s?80,00/)).toBeNull();
  });

  it("avisa o App da conta do recorte (UMA conta) — '+ Transação' nasce nela", async () => {
    routerSearch = { fc_account: ACC_B };
    const onAccountScopeChange = vi.fn();
    renderPage({ onAccountScopeChange });
    await waitFor(() => expect(onAccountScopeChange).toHaveBeenLastCalledWith(ACC_B));
  });
});
