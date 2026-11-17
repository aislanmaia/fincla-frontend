/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Atalho "Conciliar extrato" na tela de Transações (decisão do Owner de 2026-11-17, T1–T4): na
 * linha que conta as transações, só para o dono, sem quebrar a tela quando os pedidos falham.
 */

let routerSearch = {};
/** Total do período sem os outros filtros (o "de N" do cabeçalho). */
let facetTotalMock = null;
/** Histograma da faixa de valor (por moeda) devolvido pelas facetas. */
let facetBucketsMock = null;
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
  useTransactionsFacetCounts: () => ({ counts: null, isLoading: false, total: facetTotalMock, buckets: facetBucketsMock, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null }),
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
const listCreditCardsMock = vi.fn();
vi.mock("../../../api/creditCards", async (importOriginal) => ({
  ...(await importOriginal()),
  listCreditCards: (...args) => listCreditCardsMock(...args),
}));
const narrowestMock = vi.fn(() => ({ narrowest: null }));
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({
  useNarrowestFilter: (...args) => narrowestMock(...args),
}));
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));
let orgBaseCurrency = "BRL";
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: orgBaseCurrency })),
}));

const listDraftsMock = vi.fn();
vi.mock("../../../api/statementImports", async (importOriginal) => ({
  ...(await importOriginal()),
  listStatementImportDrafts: (...args) => listDraftsMock(...args),
  getStatementImport: vi.fn(() => new Promise(() => {})),
  listStatementImports: vi.fn().mockResolvedValue([]),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_EUR = "eeeeeeee-0000-4000-8000-000000000003";
const CARDS = [
  { id: 5, description: "Nubank Roxinho", brand: "Mastercard", last4: "1234", color: null },
  { id: 7, description: "Itaú Azul", brand: "Visa", last4: "9876", color: null },
];
const TWO_ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL" },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL" },
];

beforeEach(() => {
  facetTotalMock = null;
  facetBucketsMock = null;
  // `mockImplementation` de um teste sobrevive ao `clearAllMocks`: volta ao padrão.
  transactionsDataMock.mockImplementation(defaultTransactionsData);
  transactionsList = baseTransactions;
  routerSearch = {};
  orgBaseCurrency = "BRL";
  localStorage.clear();
  summaryMock = { total_income: 0, total_expenses: 120, total_refunds: 0, balance: -120, currency: "BRL" };
  listAccountsMock.mockResolvedValue(TWO_ACCOUNTS);
  listTransfersMock.mockResolvedValue([]);
  listCreditCardsMock.mockResolvedValue(CARDS);
  listDraftsMock.mockResolvedValue([]);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (props = {}) => {
  const onReconcileStatement = vi.fn();
  render(
    <TransacoesPage onNav={vi.fn()} onNewTx={vi.fn()} onEditTx={vi.fn()} isMobile={false} dataMode="live"
      organizationId="org-test" transactionsRefreshToken={0} onTransactionsInvalidate={vi.fn()}
      onReconcileStatement={onReconcileStatement} {...props} />,
  );
  return onReconcileStatement;
};

const header = () => screen.getByTestId("transactions-list-header");

describe("<TransacoesPage> — atalho Conciliar extrato", () => {
  it("UMA conta filtrada: 'Conciliar extrato da <conta>' na linha do chip do filtro, e vai direto", async () => {
    routerSearch = { fc_account: ACC_B };
    const onReconcile = renderPage();
    const chips = await screen.findByTestId("account-filter-chips");
    const btn = await within(chips).findByRole("button", { name: "Conciliar extrato da Conta B Nubank" });
    await userEvent.click(btn);
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, null);
    expect(listDraftsMock).toHaveBeenCalledWith("org-test");
  });

  it("várias contas sem filtro: 'Conciliar extrato…' na linha da contagem, antes da soma, e abre a escolha", async () => {
    const onReconcile = renderPage();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    const row = header();
    expect(row).toContainElement(btn);
    // Antes da soma, à direita da contagem.
    const soma = within(row).getByText("soma");
    expect(btn.compareDocumentPosition(soma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(btn);
    const menu = await screen.findByRole("menu", { name: "Conciliar o extrato de qual conta?" });
    // Só contas: os cartões da organização não aparecem.
    expect(within(menu).getAllByRole("menuitem").map((i) => i.querySelector("b").textContent)).toEqual(["Conta A Itaú", "Conta B Nubank"]);
    expect(menu).not.toHaveTextContent("Nubank Roxinho");
    expect(menu).not.toHaveTextContent("Itaú Azul");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Conta A Itaú/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, null);
  });

  it("organização com UMA conta ativa (e uma desativada): vai direto para a ativa, sem filtro", async () => {
    listAccountsMock.mockResolvedValue([
      { id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: true },
      { id: ACC_B, name: "Conta B Nubank", currency: "BRL", is_active: false },
    ]);
    const onReconcile = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato da Conta A Itaú" }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, null);
  });

  it("sem conta elegível: sem botão", async () => {
    listAccountsMock.mockResolvedValue([{ id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: false }]);
    renderPage();
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Conciliar extrato|Continuar conciliação/ })).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });

  it("quem não é dono (sem onReconcileStatement): sem botão e sem pedir rascunhos", async () => {
    renderPage({ onReconcileStatement: null });
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Conciliar extrato|Continuar conciliação/ })).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });

  it("erro na lista de rascunhos: texto básico, e a lista de transações segue intacta", async () => {
    listDraftsMock.mockRejectedValue(new Error("500"));
    routerSearch = { fc_account: ACC_A };
    renderPage();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Conciliar extrato da Conta A Itaú" })).toBeInTheDocument();
    expect(screen.getAllByText("Mercado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Padaria").length).toBeGreaterThan(0);
  });

  it("rascunho na conta filtrada: 'Continuar conciliação' leva ao rascunho", async () => {
    listDraftsMock.mockResolvedValue([{ id: "d-1", account_id: ACC_A, status: "draft", last_activity_at: "2026-11-14T10:00:00" }]);
    routerSearch = { fc_account: ACC_A };
    const onReconcile = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Continuar conciliação/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, "d-1");
  });

  it("celular sem filtro: o atalho aparece numa linha própria acima da contagem, sem apertar a linha", async () => {
    renderPage({ isMobile: true });
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    expect(header()).not.toContainElement(btn);
    expect(screen.getByTestId("reconcile-shortcut-row")).toContainElement(btn);
  });

  it("celular sem conta elegível: nem a linha do atalho aparece", async () => {
    listAccountsMock.mockResolvedValue([{ id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: false }]);
    renderPage({ isMobile: true });
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await screen.findAllByText("Mercado");
    expect(screen.queryByTestId("reconcile-shortcut-row")).toBeNull();
  });
});
