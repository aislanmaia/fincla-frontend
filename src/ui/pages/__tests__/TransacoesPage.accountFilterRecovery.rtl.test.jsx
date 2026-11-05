/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * #296 — filtro Conta pelo hook de dados DE VERDADE, com a mesma regra do filtro
 * Cartão (#293): só `api/transactions` é o limite mockado, então cada consulta
 * conta como uma requisição.
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
/* Referências ESTÁVEIS entre renders, como os hooks de verdade: com o hook de dados
   real, um array novo por render vira consulta nova a cada render — um laço. */
const STABLE = vi.hoisted(() => ({
  categories: { isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] },
  tags: { rows: [], loading: false, error: "" },
  facets: { counts: null, isLoading: false, total: null, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null },
  narrowest: { narrowest: null },
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => STABLE.categories,
}));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => STABLE.tags,
}));
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => STABLE.facets,
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const listTransfersMock = vi.fn();
const exportMock = vi.fn();
const listTransactionsMock = vi.fn();
const summaryApiMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: (...args) => listTransactionsMock(...args),
  getTransactionsSummary: (...args) => summaryApiMock(...args),
  exportTransactionsCsv: (...args) => exportMock(...args),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
const listCreditCardsMock = vi.fn();
vi.mock("../../../api/creditCards", async (importOriginal) => ({
  ...(await importOriginal()),
  listCreditCards: (...args) => listCreditCardsMock(...args),
}));
const narrowestMock = vi.fn(() => STABLE.narrowest);
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({
  useNarrowestFilter: (...args) => narrowestMock(...args),
}));
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));
let orgBaseCurrency = "BRL";
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: orgBaseCurrency })),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_C = "cccccccc-0000-4000-8000-000000000003";
const ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: true },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL", is_active: true },
  { id: ACC_C, name: "Conta C Inter", currency: "BRL", is_active: true },
];
const OTHER_ORG_ACCOUNTS = [
  { id: "dddddddd-0000-4000-8000-000000000004", name: "Conta D Outra", currency: "BRL", is_active: true },
  { id: "eeeeeeee-0000-4000-8000-000000000005", name: "Conta E Outra", currency: "BRL", is_active: true },
];
const API_ROW = { id: 1, description: "Mercado", amount: -100, value: 100, type: "expense", date: "2026-11-10", tags: {} };
const PAGE = { data: [API_ROW], pagination: { total: 1, has_next: false } };
const SUMMARY = { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100, currency: "BRL" };
const NOT_FOUND = () => Promise.reject(Object.assign(new Error("404"), {
  isAxiosError: true, response: { status: 404, data: { detail: { error: "ACCOUNT_NOT_FOUND", message: "Conta não encontrada", type: "not_found" } } },
}));
const hasB = (q) => (q?.account_id ?? []).includes(ACC_B);
const sentAccounts = () => listTransactionsMock.mock.calls.at(-1)[0].account_id;

beforeEach(() => {
  routerSearch = {};
  orgBaseCurrency = "BRL";
  localStorage.clear();
  listAccountsMock.mockImplementation((orgId) => Promise.resolve(orgId === "org-outra" ? OTHER_ORG_ACCOUNTS : ACCOUNTS));
  listTransfersMock.mockResolvedValue([]);
  listCreditCardsMock.mockResolvedValue([]);
  listTransactionsMock.mockImplementation(() => Promise.resolve(PAGE));
  summaryApiMock.mockImplementation(() => Promise.resolve(SUMMARY));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = (extra = {}) => ({
  onNav: vi.fn(), onNewTx: vi.fn(), onEditTx: vi.fn(), isMobile: false, dataMode: "live",
  organizationId: "org-test", transactionsRefreshToken: 0, onTransactionsInvalidate: vi.fn(), ...extra,
});
const tick = () => new Promise((r) => setTimeout(r, 50));

async function openAccountPanel() {
  const btn = screen.queryAllByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })[0];
  if (btn && btn.getAttribute("aria-expanded") !== "true") await userEvent.click(btn);
  await userEvent.click(await screen.findByRole("button", { name: /^Conta\b/ }));
  return screen.findByRole("group", { name: "Contas" });
}
const accountButton = (name) => within(screen.getByRole("group", { name: "Contas" })).getByRole("button", { name: new RegExp(name) });

describe("filtro Conta pelo hook real (#296)", () => {
  it("trocar de organização: a conta da anterior não viaja, nem na primeira consulta da nova", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await openAccountPanel();
    await userEvent.click(accountButton("Conta B Nubank"));
    await waitFor(() => expect(sentAccounts()).toEqual([ACC_B]));
    listTransactionsMock.mockClear();
    rerender(<TransacoesPage {...props({ organizationId: "org-outra" })} />);
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    await tick();
    for (const [q] of listTransactionsMock.mock.calls) {
      expect(q.organization_id).toBe("org-outra");
      expect(q).not.toHaveProperty("account_id");
    }
  });

  it("trocar de organização com a lista nova FALHANDO: o painel não mostra as contas da outra", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await openAccountPanel();
    listAccountsMock.mockImplementation(() => Promise.reject(new Error("503")));
    rerender(<TransacoesPage {...props({ organizationId: "org-outra" })} />);
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalledWith("org-outra"));
    await tick();
    expect(screen.queryByRole("button", { name: /Conta B Nubank/ })).toBeNull();
  });

  it("conta desativada em outra aba: o 404 relê as contas, o id sai da seleção e a lista volta, com aviso", async () => {
    listTransactionsMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openAccountPanel();
    await userEvent.click(accountButton("Conta A Itaú"));
    await waitFor(() => expect(sentAccounts()).toEqual([ACC_A]));
    listAccountsMock.mockResolvedValue([ACCOUNTS[0], ACCOUNTS[2]]); // a B sumiu
    await userEvent.click(accountButton("Conta B Nubank"));
    await waitFor(() => expect(sentAccounts()).toEqual([ACC_A]), { timeout: 3000 });
    expect(await screen.findByTestId("account-filter-notice")).toHaveTextContent("Uma conta selecionada não existe mais e foi removida do filtro.");
    expect(accountButton("Conta A Itaú")).toHaveAttribute("aria-pressed", "true");
  });

  it("404 com a releitura das contas FALHANDO: uma releitura só, o conjunto deixa de viajar e a conta válida não é envenenada", async () => {
    listTransactionsMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openAccountPanel();
    await userEvent.click(accountButton("Conta A Itaú"));
    await waitFor(() => expect(sentAccounts()).toEqual([ACC_A]));
    const accountReadsBefore = listAccountsMock.mock.calls.length;
    listAccountsMock.mockImplementation(() => Promise.reject(new Error("503")));
    await userEvent.click(accountButton("Conta B Nubank"));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("account_id"), { timeout: 3000 });
    expect(await screen.findByTestId("account-filter-notice")).toHaveTextContent("Não foi possível aplicar o filtro de conta");
    await tick();
    expect(listAccountsMock.mock.calls.length - accountReadsBefore).toBe(1);
    // A A não foi envenenada: sem a B, o filtro por ela volta a valer.
    await userEvent.click(accountButton("Conta B Nubank"));
    await waitFor(() => expect(sentAccounts()).toEqual([ACC_A]));
  });

  it("404 de uma conta que a lista AINDA traz: uma releitura só, depois o conjunto é recusado (sem laço)", async () => {
    listTransactionsMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (hasB(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openAccountPanel();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalledTimes(1));
    await userEvent.click(accountButton("Conta B Nubank"));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("account_id"), { timeout: 3000 });
    await tick();
    await tick();
    expect(listAccountsMock).toHaveBeenCalledTimes(2);
  });
});
