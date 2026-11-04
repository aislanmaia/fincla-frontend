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
/** Total do período sem os outros filtros (o "de N" do cabeçalho). */
let facetTotalMock = null;
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
let transactionsList;
const defaultTransactionsData = () => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: summaryMock,
  transactions: transactionsList,
  total: 2, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
});
const transactionsDataMock = vi.fn(defaultTransactionsData);
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
  useTransactionsFacetCounts: () => ({ counts: null, isLoading: false, total: facetTotalMock, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null }),
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const listTransfersMock = vi.fn();
const exportMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  exportTransactionsCsv: (...args) => exportMock(...args),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
const narrowestMock = vi.fn(() => ({ narrowest: null }));
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({
  useNarrowestFilter: (...args) => narrowestMock(...args),
}));
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));

import { TransacoesPage, computePageSize } from "../TransacoesPage.jsx";
import { readListPrefs, rowCost } from "../../features/transactions/listPrefs.js";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_EUR = "eeeeeeee-0000-4000-8000-000000000003";
const TWO_ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL" },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL" },
];

beforeEach(() => {
  facetTotalMock = null;
  // `mockImplementation` de um teste sobrevive ao `clearAllMocks`: volta ao padrão.
  transactionsDataMock.mockImplementation(defaultTransactionsData);
  transactionsList = baseTransactions;
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

  const TRANSFERS = [
    { id: "t-out", from_account_id: ACC_B, to_account_id: ACC_A, amount: 300, to_amount: 300, from_currency: "BRL", to_currency: "BRL", date: "2026-11-05T12:00:00" },
    { id: "t-in", from_account_id: ACC_A, to_account_id: ACC_B, amount: 50, to_amount: 50, from_currency: "BRL", to_currency: "BRL", date: "2026-11-08T12:00:00" },
  ];

  it("sinal da transferência pelo valor: recebida '+', enviada '−', com rótulo acessível próprio", async () => {
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue(TRANSFERS);
    renderPage();
    const recebida = await screen.findByRole("button", { name: /Transferência de Conta A Itaú, transferência recebida de/ });
    expect(recebida).toHaveTextContent(/\+\s?R\$\s?50,00/);
    const enviada = screen.getByRole("button", { name: /Transferência para Conta A Itaú, transferência enviada de/ });
    expect(enviada).toHaveTextContent(/−\s?R\$\s?300,00/);
    expect(screen.queryByRole("button", { name: /Transferência.*despesa/ })).toBeNull();
  });

  it("transferências não roubam lugar das transações na janela carregada (sem mais páginas)", async () => {
    const pageSize = computePageSize(window.innerHeight - 240, rowCost(readListPrefs().density, false, readListPrefs().grouped));
    transactionsList = Array.from({ length: pageSize }, (_, i) => ({
      id: `tx-${i}`, date: `${String(28 - Math.floor(i / 4)).padStart(2, "0")}/11/2026`, desc: `Lançamento ${i}`,
      cat: "Alimentação", val: -10, method: "Pix", type: "expense", icon: "🍽", status: "confirmado", rec: false,
      tags: [], settled: true, settleable: true,
    }));
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue([
      { ...TRANSFERS[0], date: "2026-11-27T12:00:00" },
      { ...TRANSFERS[1], date: "2026-11-26T12:00:00" },
    ]);
    renderPage();
    await screen.findAllByText("Transferência para Conta A Itaú");
    // A ÚLTIMA transação da janela continua na tela.
    expect(screen.getAllByText(`Lançamento ${pageSize - 1}`).length).toBeGreaterThan(0);
  });

  it("ordenação que não é por data: sem transferências, com o aviso", async () => {
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue(TRANSFERS);
    renderPage();
    await screen.findAllByText("Transferência para Conta A Itaú");
    await openFilters();
    await userEvent.click(screen.getByRole("button", { name: /Ordenar transações: Data ↓/i }));
    await userEvent.click(screen.getByRole("button", { name: /Ordenar por Valor/i }));
    expect(await screen.findByTestId("transfers-sort-note")).toHaveTextContent("Transferências aparecem na ordenação por data.");
    expect(screen.queryByText("Transferência para Conta A Itaú")).toBeNull();
  });

  it("o cabeçalho conta as transferências à parte e a lista com só transferências não é 'vazia'", async () => {
    transactionsList = [];
    summaryMock = { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0, currency: "BRL" };
    transactionsDataMock.mockImplementation(() => ({
      isLoading: false, error: "", hasLoaded: true, summary: summaryMock, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    }));
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue(TRANSFERS);
    renderPage();
    expect(await screen.findByTestId("list-header-transfers")).toHaveTextContent("2 transferências");
    expect(screen.getAllByText("Transferência para Conta A Itaú").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nenhuma transação/i)).toBeNull();
  });

  it("subtotal do dia ignora transferências", async () => {
    transactionsList = [{ id: "tx-d", date: "05/11/2026", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
      type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [], settled: true, settleable: true }];
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue([TRANSFERS[0]]); // −300 no mesmo dia 05/11
    localStorage.setItem("fincla:transactions:list-prefs", JSON.stringify({ grouped: true }));
    renderPage();
    await screen.findAllByText("Transferência para Conta A Itaú");
    expect(screen.getAllByText(/−\s?R\$\s?40,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/−\s?R\$\s?340,00/)).toBeNull();
  });

  it("muda a busca e volta: as transferências da conta não são rebuscadas (cache por conta + token)", async () => {
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue(TRANSFERS);
    renderPage();
    await screen.findAllByText("Transferência para Conta A Itaú");
    expect(listTransfersMock).toHaveBeenCalledTimes(1);
    const busca = screen.getAllByLabelText("Buscar transações")[0];
    await userEvent.type(busca, "x");
    await waitFor(() => expect(screen.queryByText("Transferência para Conta A Itaú")).toBeNull());
    await userEvent.clear(busca);
    await screen.findAllByText("Transferência para Conta A Itaú");
    expect(listTransfersMock).toHaveBeenCalledTimes(1);
  });

  it("com UMA conta, a seleção de conta sai do estado: lista vazia não oferece 'Limpar filtros' por um filtro invisível", async () => {
    listAccountsMock.mockResolvedValue([TWO_ACCOUNTS[0]]);
    transactionsDataMock.mockImplementation(() => ({
      isLoading: false, error: "", hasLoaded: true, summary: { ...summaryMock, total_expenses: 0, balance: 0 },
      transactions: [], total: 0, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    }));
    routerSearch = { fc_account: ACC_A };
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    // Quando a lista de contas chega (uma só), a seleção sai do estado.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull());
    expect(screen.getByRole("button", { name: "+ Nova transação" })).toBeInTheDocument();
  });

  it("exportar CSV com conta filtrada vai ao export de Transações com account_id", async () => {
    routerSearch = { fc_account: ACC_B };
    exportMock.mockResolvedValue(new Blob(["x"]));
    renderPage();
    await waitFor(() => expect(lastFilters().accountIds).toEqual([ACC_B]));
    const exportar = screen.queryAllByRole("button", { name: /Exportar|CSV/i })[0];
    expect(exportar).toBeTruthy();
    await userEvent.click(exportar);
    const csvItem = screen.queryAllByRole("menuitem", { name: /CSV/i })[0] ?? screen.queryAllByRole("button", { name: /CSV/i }).find((b) => b !== exportar);
    if (csvItem) await userEvent.click(csvItem);
    await waitFor(() => expect(exportMock).toHaveBeenCalled());
    expect(exportMock.mock.calls[0][0].account_id).toEqual([ACC_B]);
  });

  it("lista vazia sob filtro de conta: 'conta' entra nos candidatos do filtro mais restritivo", async () => {
    transactionsDataMock.mockImplementation(() => ({
      isLoading: false, error: "", hasLoaded: true, summary: { ...summaryMock, total_expenses: 0, balance: 0 },
      transactions: [], total: 0, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    }));
    routerSearch = { fc_account: ACC_B, fc_type: "income" };
    renderPage();
    await waitFor(() => {
      const byKey = narrowestMock.mock.calls.at(-1)[0].filtersByKey;
      expect(byKey).toHaveProperty("conta");
      expect(byKey.conta.accountIds).toBeUndefined();
      // Os outros candidatos mantêm o recorte de conta.
      expect(byKey.tipo.accountIds).toEqual([ACC_B]);
    });
  });

  it("desfazer nomeia a conta (chips/undo recebem o mapa de contas)", async () => {
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await openFilters();
    await userEvent.click(await screen.findByRole("button", { name: /^Conta\b/ }));
    const group = await screen.findByRole("group", { name: "Contas" });
    await userEvent.click(within(group).getByRole("button", { name: /Conta A Itaú/ }));
    await waitFor(() => expect(document.body.innerHTML).toMatch(/Desfazer[^"]*Conta A Itaú/));
  });

  it("com conta filtrada, o cabeçalho não mostra o 'de N' da organização: '1 transação · 1 transferência'", async () => {
    facetTotalMock = 8;
    transactionsList = [baseTransactions[0]];
    transactionsDataMock.mockImplementation(() => ({ ...defaultTransactionsData(), total: 1 }));
    routerSearch = { fc_account: ACC_B, fc_from: "2026-11-01", fc_to: "2026-11-30" };
    listTransfersMock.mockResolvedValue([TRANSFERS[1]]);
    renderPage();
    const header = (await screen.findByTestId("list-header-transfers")).parentElement;
    expect(header).toHaveTextContent("transação · 1 transferência");
    expect(header).not.toHaveTextContent(/de\s*8/);
  });

  it("chip da conta filtrada à vista; o ✕ tira o filtro de conta", async () => {
    routerSearch = { fc_account: ACC_B };
    renderPage();
    const chips = await screen.findByTestId("account-filter-chips");
    expect(chips).toHaveTextContent("Conta B Nubank");
    await waitFor(() => expect(lastFilters().accountIds).toEqual([ACC_B]));
    await userEvent.click(within(chips).getByRole("button", { name: "Remover filtro de conta Conta B Nubank" }));
    await waitFor(() => expect(lastFilters().accountIds).toBeUndefined());
    expect(screen.queryByTestId("account-filter-chips")).toBeNull();
  });
});

